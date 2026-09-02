/**
 * The popup: pair once, then review and save.
 *
 * All the work happens here — there is no service worker, because there is
 * nothing to do in the background. The popup injects the content script into
 * the active tab on open, reads what came back, runs it through the same
 * parser the web app uses, and lets the user correct anything before it saves.
 */
import {
  parseJobAd,
  formatSalary,
  CURRENCY_CODES,
  SALARY_PERIODS,
  SALARY_PERIOD_META,
} from "../../src/lib/job-ad";
import type { Extracted } from "./adapters";

declare const chrome: {
  storage: {
    local: {
      get: (k: string[]) => Promise<Record<string, string>>;
      set: (v: Record<string, string>) => Promise<void>;
      remove: (k: string[]) => Promise<void>;
    };
  };
  tabs: {
    query: (q: {
      active: boolean;
      currentWindow: boolean;
    }) => Promise<{ id?: number; url?: string }[]>;
    create: (o: { url: string }) => void;
  };
  scripting: {
    executeScript: (o: { target: { tabId: number }; files: string[] }) => Promise<unknown>;
  };
  runtime: {
    onMessage: {
      addListener: (
        fn: (msg: { type: string; payload?: Extracted; diag?: unknown; message?: string }) => void,
      ) => void;
    };
    lastError?: { message: string };
  };
};

const DEFAULT_API = "https://job-tracker-rho-khaki-34.vercel.app";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const show = (id: string, on = true) => ($(id).hidden = !on);

let apiBase = DEFAULT_API;
let token = "";
let extracted: Extracted | null = null;
let diagnostic: unknown = null;

/* ------------------------------------------------------------------ */

function fillSelect(el: HTMLSelectElement, options: [value: string, label: string][]) {
  el.innerHTML = "";
  for (const [value, label] of options) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    el.append(opt);
  }
}

async function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
}

/* ------------------------------------------------------------------ *
 * Pairing
 * ------------------------------------------------------------------ */

function showConnect() {
  show("loading", false);
  show("form", false);
  show("done", false);
  show("settings", false);
  show("connect", true);
  ($("api-base") as HTMLInputElement).value = apiBase;
  ($("pair-link") as HTMLAnchorElement).href = `${apiBase}/account`;
}

/**
 * Tidy up an address someone typed.
 *
 * A bare host gets a scheme, and `https://localhost` becomes `http://` —
 * local dev servers are plain HTTP, the field is `type="url"` so browsers
 * nudge towards https, and the resulting connection failure otherwise looks
 * exactly like a bad pairing code.
 */
function normaliseBase(input: string): string {
  let base = input.trim().replace(/\/+$/, "");
  if (!base) return DEFAULT_API;
  if (!/^https?:\/\//i.test(base)) base = `http://${base}`;
  try {
    const url = new URL(base);
    if (url.protocol === "https:" && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname)) {
      url.protocol = "http:";
    }
    return url.origin;
  } catch {
    return base;
  }
}

async function pair() {
  const code = ($("pair-code") as HTMLInputElement).value.trim();
  const typed = ($("api-base") as HTMLInputElement).value;
  const error = $("pair-error");

  if (!code) {
    error.textContent = "Paste the pairing code from your account page.";
    show("pair-error", true);
    return;
  }

  const base = normaliseBase(typed);
  ($("api-base") as HTMLInputElement).value = base;
  apiBase = base;
  token = code;

  // Prove the code works before storing it, so a mistake surfaces here rather
  // than silently at the first clip. The two ways this fails want different
  // fixes, so they get different messages: an unreachable server is an address
  // problem, a 401 is a code problem.
  let res: Response;
  try {
    res = await api("/clip/applications");
  } catch {
    error.textContent = `Couldn't reach ${base}. Check the address, and that Job Tracker is running there.`;
    show("pair-error", true);
    token = "";
    return;
  }

  if (res.status === 401) {
    error.textContent = "That code didn't work. Copy it again from your account page.";
    show("pair-error", true);
    token = "";
    return;
  }
  if (!res.ok) {
    error.textContent = `${base} answered ${res.status}. Is that the right address?`;
    show("pair-error", true);
    token = "";
    return;
  }

  await chrome.storage.local.set({ token, apiBase });
  show("pair-error", false);
  await start();
}

async function disconnect() {
  await chrome.storage.local.remove(["token"]);
  token = "";
  showConnect();
  show("settings", false);
}

/* ------------------------------------------------------------------ *
 * Reading the page
 * ------------------------------------------------------------------ */

function render(data: Extracted) {
  extracted = data;
  const parsed = parseJobAd(data.rawText);

  ($("company") as HTMLInputElement).value = data.company;
  ($("position") as HTMLInputElement).value = data.position;
  ($("description") as HTMLTextAreaElement).value = parsed.description;
  ($("requirements") as HTMLTextAreaElement).value = parsed.requirements ?? "";

  fillSelect($("salary_currency"), [
    ["", "Currency"],
    ...CURRENCY_CODES.map((c) => [c, c] as [string, string]),
  ]);
  fillSelect($("salary_period"), [
    ["", "Per…"],
    ...SALARY_PERIODS.map((p) => [p, SALARY_PERIOD_META[p].label] as [string, string]),
  ]);

  if (parsed.salary) {
    ($("salary_min") as HTMLInputElement).value = parsed.salary.salary_min?.toString() ?? "";
    ($("salary_max") as HTMLInputElement).value = parsed.salary.salary_max?.toString() ?? "";
    ($("salary_currency") as HTMLSelectElement).value = parsed.salary.salary_currency ?? "";
    ($("salary_period") as HTMLSelectElement).value = parsed.salary.salary_period ?? "";
    const label = formatSalary(parsed.salary);
    $("salary-found").textContent =
      parsed.salary.confidence === "low"
        ? `Read ${label} from the ad — worth a check, it was vague.`
        : `Read ${label} from the ad.`;
    show("salary-found", true);
  }

  $("req-count").textContent = parsed.requirements
    ? `· ${parsed.requirements.length.toLocaleString()} chars`
    : "· none found";
  $("desc-count").textContent = `· ${parsed.description.length.toLocaleString()} chars`;

  // Say plainly how the page was read. Falling back on a site we *do* have an
  // adapter for means that adapter is broken — usually the site changed its
  // markup — and that is a different message from an unknown site, because it
  // is a bug to report rather than a limitation to accept.
  const expandedNote = data.expanded ? " Expanded the collapsed description first." : "";
  $("read-note").textContent = !data.fellBack
    ? `Read the ad from ${data.adapter}.${expandedNote}`
    : data.adapter === "generic"
      ? "Read the whole visible page — this site isn't one we know in detail, so check the fields below."
      : `Couldn't find the ad on this ${data.adapter} page, so the whole visible page was read instead. Check the fields below — and the ${data.adapter} layout may have changed.`;

  show("loading", false);
  show("form", true);
}

async function loadApplications() {
  try {
    const res = await api("/clip/applications");
    if (!res.ok) return;
    const rows = (await res.json()) as { id: string; company: string; position: string }[];
    const select = $("target") as HTMLSelectElement;
    for (const row of rows) {
      const opt = document.createElement("option");
      opt.value = row.id;
      opt.textContent = `${row.position} · ${row.company}`;
      select.append(opt);
    }
  } catch {
    /* The target list is a convenience; a new application still works without it. */
  }
}

/* ------------------------------------------------------------------ *
 * Saving
 * ------------------------------------------------------------------ */

async function save() {
  const button = $("save") as HTMLButtonElement;
  const error = $("save-error");
  button.disabled = true;
  button.textContent = "Saving…";
  show("save-error", false);

  const body = {
    company: ($("company") as HTMLInputElement).value.trim(),
    position: ($("position") as HTMLInputElement).value.trim(),
    city: extracted?.city ?? "",
    country: extracted?.country ?? "",
    application_id: ($("target") as HTMLSelectElement).value || undefined,
    ad: {
      job_url: extracted?.job_url ?? "",
      description: ($("description") as HTMLTextAreaElement).value,
      requirements: ($("requirements") as HTMLTextAreaElement).value,
      salary_min: ($("salary_min") as HTMLInputElement).value,
      salary_max: ($("salary_max") as HTMLInputElement).value,
      salary_currency: ($("salary_currency") as HTMLSelectElement).value,
      salary_period: ($("salary_period") as HTMLSelectElement).value,
      salary_source:
        ($("salary_min") as HTMLInputElement).value || ($("salary_max") as HTMLInputElement).value
          ? "posted"
          : "",
    },
  };

  try {
    const res = await api("/clip", { method: "POST", body: JSON.stringify(body) });
    const result = (await res.json()) as { id?: string; created?: boolean; error?: string };
    if (!res.ok) throw new Error(result.error ?? "Could not save");

    show("form", false);
    show("done", true);
    // A clip lands in the wishlist, not in Applied — say so, or the first
    // thing the user does is go looking for it in the wrong column.
    $("done-text").textContent = result.created
      ? "Saved to your wishlist, with the ad kept in full."
      : "Updated the application you already had for this posting.";
    ($("done-link") as HTMLAnchorElement).href = `${apiBase}/applications/${result.id}`;
  } catch (e) {
    error.textContent = e instanceof Error ? e.message : "Could not save";
    show("save-error", true);
    button.disabled = false;
    button.textContent = "Save to Job Tracker";
  }
}

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */

async function start() {
  show("connect", false);
  show("done", false);
  show("loading", true);
  show("settings", true);

  void loadApplications();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    $("loading").textContent = "No page to read here.";
    return;
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "jobtracker:extracted" && msg.payload) {
      diagnostic = msg.diag ?? null;
      render(msg.payload);
    }
    if (msg.type === "jobtracker:error")
      $("loading").textContent = msg.message ?? "Could not read this page.";
  });

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  } catch {
    $("loading").textContent =
      "This page can't be read — browser pages and the web store are off limits.";
  }
}

async function boot() {
  const stored = await chrome.storage.local.get(["token", "apiBase"]);
  apiBase = stored.apiBase || DEFAULT_API;
  token = stored.token || "";

  $("pair-save").addEventListener("click", () => void pair());
  $("save").addEventListener("click", () => void save());
  $("copy-diag").addEventListener("click", () => {
    void navigator.clipboard.writeText(JSON.stringify(diagnostic, null, 1));
    $("copy-diag").textContent = "Copied — paste it to Claude";
  });
  $("settings").addEventListener("click", () => void disconnect());

  if (token) await start();
  else showConnect();
}

void boot();
