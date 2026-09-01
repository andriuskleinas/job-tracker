/**
 * Site adapters.
 *
 * Each adapter names the DOM it knows about. None of them is allowed to fail:
 * `extract` returns whatever it recognised plus `rawText`, and when a selector
 * misses, `rawText` falls back to the page's visible text and `fellBack` is
 * set. The shared parser in src/lib/job-ad.ts then reads that text exactly as
 * it reads a manual paste — so a LinkedIn redesign degrades this extension to
 * "as good as pasting", never to broken.
 */

export type Extracted = {
  company: string;
  position: string;
  city: string;
  country: string;
  job_url: string;
  /** The ad body if a selector matched it, else the whole visible page. */
  rawText: string;
  adapter: string;
  fellBack: boolean;
};

export type Adapter = {
  id: string;
  match: (url: URL) => boolean;
  extract: (doc: Document, url: URL) => Omit<Extracted, "adapter" | "fellBack" | "job_url">;
};

/**
 * First non-empty text among the given selectors.
 *
 * `innerText` is preferred because it respects line breaks and skips hidden
 * nodes, which keeps a pasted-looking ad readable. It depends on layout
 * though, and returns empty in any context without it — so `textContent` backs
 * it up rather than letting a perfectly good match look like a miss.
 */
function pick(doc: Document, selectors: string[]): string {
  for (const selector of selectors) {
    const el = doc.querySelector(selector) as HTMLElement | null;
    if (!el) continue;
    const text = (el.innerText || el.textContent || "").trim();
    if (text) return text;
  }
  return "";
}

function textOf(el: Element | null): string {
  if (!el) return "";
  return ((el as HTMLElement).innerText || el.textContent || "").trim();
}

/**
 * Share of an element's text that sits inside links.
 *
 * Navigation, "people also viewed", and a job-search results list are almost
 * all links; the body of an ad is almost none. This is what lets the fallback
 * below tell the ad apart from the furniture around it.
 */
function linkDensity(el: Element): number {
  const total = textOf(el).length;
  if (total === 0) return 1;
  let linked = 0;
  for (const a of Array.from(el.querySelectorAll("a"))) linked += textOf(a).length;
  return linked / total;
}

/**
 * The element holding the ad body.
 *
 * Scored rather than measured: `length * (1 - linkDensity)^2` rewards prose and
 * punishes anything link-heavy, which is what separates an ad from a results
 * list, a nav bar or a "people also viewed" rail. Picking the *largest* such
 * block matters — an earlier version took the smallest block over a threshold
 * and happily returned a 423-character sidebar card instead of the job.
 *
 * Deliberately structural. Sites that hash their class names — LinkedIn ships
 * things like `aa13b50b _01e54e47` — defeat any selector written against them.
 */
function score(el: Element): number {
  const density = linkDensity(el);
  if (density > 0.35) return 0;
  return textOf(el).length * (1 - density) ** 2;
}

function bestContentElement(doc: Document, minChars = 400): Element | null {
  let best: Element | null = null;
  let bestScore = 0;

  for (const el of Array.from(doc.querySelectorAll("div, section, article, main, td"))) {
    if ((el.textContent ?? "").trim().length < minChars) continue;
    const s = score(el);
    if (s > bestScore) {
      best = el;
      bestScore = s;
    }
  }

  // Peel off wrappers. Compare children by the same score, not by raw text
  // share: on LinkedIn the ad's own container sits beside a "Job match is high"
  // promo card, so it holds well under 90% of the wrapper's text and a
  // share-based rule keeps the promo. A child that scores nearly as well as its
  // parent *is* the content; one that scores far worse is only a piece of it.
  for (let depth = 0; best && depth < 12; depth++) {
    const parentScore = score(best);
    let child: Element | null = null;
    let childScore = 0;
    for (const c of Array.from(best.children)) {
      if ((c.textContent ?? "").trim().length < minChars) continue;
      const s = score(c);
      if (s > childScore) {
        child = c;
        childScore = s;
      }
    }
    if (!child || childScore < parentScore * 0.7) break;
    best = child;
  }
  return best;
}

/** The ad body as text, or "" when nothing on the page looks like one. */
function largestTextBlock(doc: Document, minChars = 400): string {
  return textOf(bestContentElement(doc, minChars));
}

/** Headings that belong to the page's furniture rather than to a job. */
const CHROME_HEADING =
  /^(linkedin|jobs?|search|notifications?|messaging|my network|home|menu|\d+\s+(new\s+)?(notifications?|messages?|invitations?))$/i;

function inChrome(el: Element): boolean {
  return !!el.closest("nav, header, aside, footer, [role='navigation'], [role='banner']");
}

/**
 * A heading that looks like a job title.
 *
 * Scoped to the ad's own container when we have one — LinkedIn keeps headings
 * like "2 notifications" in its chrome, and searching the whole document in
 * source order finds those long before it finds the job.
 */
function headingTitle(doc: Document, within?: Element | null): string {
  const roots: (Element | Document)[] = [];
  // Walk out from the ad block, so the nearest enclosing heading wins.
  for (let el = within ?? null; el; el = el.parentElement) roots.push(el);
  roots.push(doc);

  for (const root of roots) {
    for (const tag of ["h1", "h2"]) {
      for (const el of Array.from(root.querySelectorAll(tag))) {
        const text = textOf(el);
        if (text.length < 3 || text.length > 150) continue;
        if (CHROME_HEADING.test(text) || inChrome(el)) continue;
        return text;
      }
    }
  }
  return "";
}

/** Split "Vilnius, Lithuania" into its parts; a single token is the city. */
function splitPlace(place: string): { city: string; country: string } {
  const parts = place
    .split(/,|·|\|/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { city: "", country: "" };
  if (parts.length === 1) return { city: parts[0], country: "" };
  return { city: parts[0], country: parts[parts.length - 1] };
}

/** Turn a board slug (`/acme/jobs/123`) into a plausible company name. */
function slugToName(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

const greenhouse: Adapter = {
  id: "greenhouse",
  match: (url) => /(^|\.)(job-)?boards\.greenhouse\.io$/.test(url.hostname),
  extract: (doc, url) => {
    const place = pick(doc, [".location", "#location", ".job__location"]);
    return {
      company:
        pick(doc, [".company-name"]).replace(/^at\s+/i, "") ||
        slugToName(url.pathname.split("/").filter(Boolean)[0] ?? ""),
      position: pick(doc, [".app-title", "h1.section-header", "h1"]),
      rawText: pick(doc, ["#content", ".job__description", "main"]),
      ...splitPlace(place),
    };
  },
};

const lever: Adapter = {
  id: "lever",
  match: (url) => url.hostname === "jobs.lever.co",
  extract: (doc, url) => {
    const place = pick(doc, [".posting-categories .location", ".location"]);
    return {
      company: slugToName(url.pathname.split("/").filter(Boolean)[0] ?? ""),
      position: pick(doc, [".posting-headline h2", "h2"]),
      rawText: pick(doc, ['[data-qa="job-description"]', ".section-wrapper", "main"]),
      ...splitPlace(place),
    };
  },
};

const ashby: Adapter = {
  id: "ashby",
  match: (url) => url.hostname === "jobs.ashbyhq.com",
  extract: (doc, url) => {
    // Ashby ships hashed class names, so match on the stable substring.
    const place = pick(doc, ['[class*="location"]']);
    return {
      company: slugToName(url.pathname.split("/").filter(Boolean)[0] ?? ""),
      position: pick(doc, ["h1", '[class*="jobTitle"]']),
      rawText: pick(doc, ['[class*="descriptionText"]', '[class*="jobDescription"]', "main"]),
      ...splitPlace(place),
    };
  },
};

const linkedin: Adapter = {
  id: "linkedin",
  match: (url) => /(^|\.)linkedin\.com$/.test(url.hostname),
  extract: (doc) => {
    const found = bestContentElement(doc);
    const place = pick(doc, [
      ".job-details-jobs-unified-top-card__bullet",
      ".job-details-jobs-unified-top-card__primary-description-container span:first-child",
      ".topcard__flavor--bullet",
    ]);
    return {
      company:
        pick(doc, [
          ".job-details-jobs-unified-top-card__company-name",
          ".topcard__org-name-link",
          ".jobs-unified-top-card__company-name",
          ".artdeco-entity-lockup__title",
        ]) ||
        // Every LinkedIn job links its company; the first such link is it.
        textOf(doc.querySelector('a[href*="/company/"]')),
      position:
        pick(doc, [
          ".job-details-jobs-unified-top-card__job-title",
          ".topcard__title",
          ".jobs-unified-top-card__job-title",
          ".jobs-search__job-details--wrapper h1",
        ]) || headingTitle(doc, found),
      rawText:
        pick(doc, [
          ".jobs-description__content",
          ".jobs-box__html-content",
          ".description__text",
          "#job-details",
          ".jobs-description-content__text",
        ]) || textOf(found),
      ...splitPlace(place),
    };
  },
};

const workday: Adapter = {
  id: "workday",
  match: (url) => /myworkdayjobs\.com$/.test(url.hostname),
  extract: (doc, url) => {
    const place = pick(doc, [
      '[data-automation-id="locations"]',
      '[data-automation-id="location"]',
    ]);
    return {
      // Workday tenants are subdomains: acme.wd1.myworkdayjobs.com
      company: slugToName(url.hostname.split(".")[0] ?? ""),
      position: pick(doc, ['[data-automation-id="jobPostingHeader"]', "h1", "h2"]),
      rawText: pick(doc, ['[data-automation-id="jobPostingDescription"]', "main"]),
      ...splitPlace(place),
    };
  },
};

/** Last resort: whatever the page shows. Registered last, matches everything. */
const generic: Adapter = {
  id: "generic",
  match: () => true,
  extract: (doc) => ({
    company: "",
    // Page titles are usually "Job Title - Company | Board".
    position:
      headingTitle(doc, bestContentElement(doc)) || (doc.title.split(/[|–—-]/)[0] ?? "").trim(),
    city: "",
    country: "",
    rawText: largestTextBlock(doc) || pick(doc, ["main", "article", '[role="main"]']),
  }),
};

const ADAPTERS: Adapter[] = [greenhouse, lever, ashby, linkedin, workday, generic];

/**
 * Read the current page. Always returns something usable — the point of the
 * fallback is that a broken selector costs fidelity, never the capture.
 */
export function extractFromPage(doc: Document, href: string): Extracted {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    url = new URL("https://example.invalid");
  }

  const adapter = ADAPTERS.find((a) => a.match(url)) ?? generic;
  let fields: ReturnType<Adapter["extract"]>;
  try {
    fields = adapter.extract(doc, url);
  } catch {
    fields = { company: "", position: "", city: "", country: "", rawText: "" };
  }

  const visible = (doc.body?.innerText || doc.body?.textContent || "").trim();
  const fellBack = fields.rawText.trim().length < 200;

  return {
    ...fields,
    rawText: fellBack ? visible : fields.rawText,
    job_url: href,
    adapter: adapter.id,
    fellBack,
  };
}
