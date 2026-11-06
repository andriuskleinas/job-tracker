/**
 * `/company-website?name=…` — find a company's website from its name, so the
 * new-application form can fill it (and show the logo) without the user
 * looking it up. Clearbit's free name→domain autocomplete answers first;
 * Wikidata's "official website" (P856) backs it up for when Clearbit has
 * nothing or is down.
 *
 * Only an exact name match counts: a wrong website puts someone else's logo
 * on the card, which is worse than no website at all.
 */

const FETCH_TIMEOUT_MS = 4000;
const ONE_DAY = 60 * 60 * 24;
const MAX_NAME_LENGTH = 120;
const USER_AGENT = "JobTracker/1.0 (company website lookup)";

/** Legal-form words that never belong to the name itself. */
const LEGAL_SUFFIX =
  /[\s,]+(?:inc|incorporated|ltd|limited|llc|llp|plc|corp|corporation|co|gmbh|ag|se|sa|sas|sarl|srl|spa|bv|nv|ab|as|asa|aps|oy|oyj|uab|ou|oü|sia|sp\. ?z ?o\.? ?o|kft|pty|pte|kk)\.?$/i;

/** `Revolut Ltd.` → `Revolut`; `Acme, Inc.` → `Acme`. */
export function cleanCompanyName(name: string): string {
  let out = name.trim().replace(/\s+/g, " ");
  for (let i = 0; i < 2 && LEGAL_SUFFIX.test(out); i++) out = out.replace(LEGAL_SUFFIX, "");
  return out.trim();
}

/** Compare names by letters and digits only, ignoring a trailing `.com`-style label. */
export function nameKey(name: string): string {
  return cleanCompanyName(name)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\.(?:com|io|ai|co|net|org|app)$/, "")
    .replace(/[^a-z0-9]/g, "");
}

type Suggestion = { name: string; domain: string };

/** The first suggestion whose name is the company's name, ranked as the source ranked them. */
export function pickSuggestion(name: string, suggestions: Suggestion[]): string | null {
  const key = nameKey(name);
  if (!key) return null;
  const hit = suggestions.find((s) => s.domain && nameKey(s.name) === key);
  return hit ? hit.domain.toLowerCase().replace(/^www\./, "") : null;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function fromClearbit(name: string): Promise<string | null> {
  const data = await getJson(
    `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(name)}`,
  );
  return Array.isArray(data) ? pickSuggestion(name, data as Suggestion[]) : null;
}

type WikidataSearch = { search?: { id: string; label?: string }[] };
type WikidataEntities = {
  entities?: Record<
    string,
    { claims?: { P856?: { mainsnak?: { datavalue?: { value?: unknown } } }[] } }
  >;
};

async function fromWikidata(name: string): Promise<string | null> {
  const api = "https://www.wikidata.org/w/api.php?format=json&origin=*";
  const search = (await getJson(
    `${api}&action=wbsearchentities&type=item&language=en&limit=7&search=${encodeURIComponent(name)}`,
  )) as WikidataSearch;
  const key = nameKey(name);
  const ids = (search.search ?? []).filter((r) => r.label && nameKey(r.label) === key);
  if (!ids.length) return null;
  const entities = (await getJson(
    `${api}&action=wbgetentities&props=claims&ids=${ids.map((r) => r.id).join("|")}`,
  )) as WikidataEntities;
  // A village called "Wix" has no official website; the company does.
  for (const { id } of ids) {
    const site = entities.entities?.[id]?.claims?.P856?.[0]?.mainsnak?.datavalue?.value;
    if (typeof site !== "string") continue;
    try {
      return new URL(site).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }
  }
  return null;
}

export async function findCompanyWebsite(raw: string): Promise<string | null> {
  const name = cleanCompanyName(raw);
  if (name.length < 2) return null;
  for (const source of [fromClearbit, fromWikidata]) {
    try {
      const site = await source(name);
      if (site) return site;
    } catch {
      // Try the next source.
    }
  }
  return null;
}

export async function handleCompanyWebsite(request: Request): Promise<Response> {
  const name = new URL(request.url).searchParams.get("name")?.trim() ?? "";
  if (!name || name.length > MAX_NAME_LENGTH) {
    return Response.json({ error: "Bad name" }, { status: 400 });
  }
  const website = await findCompanyWebsite(name);
  // Companies rarely move; cache hits and misses alike at the edge.
  return Response.json(
    { website },
    { headers: { "cache-control": `public, max-age=${ONE_DAY}, s-maxage=${ONE_DAY * 7}` } },
  );
}
