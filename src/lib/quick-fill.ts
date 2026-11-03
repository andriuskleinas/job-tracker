/**
 * Quick fill: turn whatever someone pastes into the New application dialog —
 * a link to the posting, or the posting itself — into suggested values for
 * the whole form, not just the job-ad block.
 *
 * Pure and dependency-free like job-ad.ts, and held to the same rule: every
 * value found here is a suggestion that lands in a visible, editable field and
 * is named in the summary the dialog shows, never a silent write. When a
 * signal is ambiguous the field stays empty — an empty field gets noticed, a
 * wrong one gets trusted.
 */
import { parseJobAd, type ParsedAd } from "./job-ad";
import { CITIES, COUNTRIES, type JobType } from "./job-location";

export type QuickFill = {
  company: string | null;
  position: string | null;
  /** The employer's own site, for the logo — only when the link is on it. */
  website: string | null;
  job_url: string | null;
  job_type: JobType | null;
  city: string | null;
  country: string | null;
  /** The parsed posting — null when only a link was pasted. */
  ad: ParsedAd | null;
};

type Place = Pick<QuickFill, "city" | "country" | "job_type">;
type LinkFill = Omit<QuickFill, "ad" | "job_url">;

const EMPTY_LINK: LinkFill = {
  company: null,
  position: null,
  website: null,
  job_type: null,
  city: null,
  country: null,
};

/* ------------------------------------------------------------------ *
 * Places
 * ------------------------------------------------------------------ */

/** Lowercase with the accents stripped, so `Zurich` finds `Zürich`. */
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Spellings people and job boards actually use for names in the reference lists. */
const COUNTRY_ALIASES: Record<string, string> = {
  usa: "United States",
  us: "United States",
  "united states of america": "United States",
  uk: "United Kingdom",
  "great britain": "United Kingdom",
  england: "United Kingdom",
  scotland: "United Kingdom",
  "czech republic": "Czechia",
  turkey: "Türkiye",
  holland: "Netherlands",
  "the netherlands": "Netherlands",
  uae: "United Arab Emirates",
  korea: "South Korea",
};

const CITY_ALIASES: Record<string, string> = {
  nyc: "New York",
  kiev: "Kyiv",
  bangalore: "Bengaluru",
  "new delhi": "Delhi",
  munchen: "Munich",
  koln: "Cologne",
  wien: "Vienna",
  praha: "Prague",
  lisboa: "Lisbon",
  roma: "Rome",
  milano: "Milan",
  warszawa: "Warsaw",
  kobenhavn: "Copenhagen",
  goteborg: "Gothenburg",
  "the hague": "The Hague",
};

const COUNTRY_BY_KEY = new Map<string, string>([
  ...COUNTRIES.map((c) => [fold(c.name), c.name] as [string, string]),
  ...Object.entries(COUNTRY_ALIASES),
]);

const CITY_BY_KEY = new Map(CITIES.map((c) => [fold(c.city), c]));
for (const [alias, name] of Object.entries(CITY_ALIASES)) {
  const city = CITY_BY_KEY.get(fold(name));
  if (city) CITY_BY_KEY.set(alias, city);
}

const REMOTE_WORD = /^(?:remote|fully remote|anywhere|work from home|wfh|nuotoliniu budu)$/;
const HYBRID_WORD = /^(?:hybrid|hibridinis|hibridinis darbas)$/;

/**
 * Read a city, country and work mode out of a handful of short tokens —
 * `Vilnius, Lithuania`, `Lithuania---Vilnius`, `USA-New-York-NY`. Every run
 * of up to four adjacent words is tried, so multi-word names survive being
 * written with hyphens.
 */
function placeFromTokens(tokens: string[], { loose = false } = {}): Place {
  const place: Place = { city: null, country: null, job_type: null };
  const words = tokens.map(fold).filter(Boolean);
  for (let size = 4; size >= 1; size--) {
    for (let i = 0; i + size <= words.length; i++) {
      const phrase = words.slice(i, i + size).join(" ");
      // Loose matching is word by word through prose, where `us` and `it`
      // are pronouns, not countries — and `remote` can be "remote Fridays".
      if (loose && phrase.length < 3) continue;
      const city = CITY_BY_KEY.get(phrase);
      if (city && !place.city) place.city = city.city;
      const country = COUNTRY_BY_KEY.get(phrase);
      if (country && !place.country) place.country = country;
      if (loose) continue;
      if (!place.job_type && REMOTE_WORD.test(phrase)) place.job_type = "remote";
      if (HYBRID_WORD.test(phrase)) place.job_type = "hybrid";
    }
  }
  if (place.city && !place.country) {
    place.country = CITY_BY_KEY.get(fold(place.city))?.country ?? null;
  }
  return place;
}

/** A location written out in prose: `Vilnius, Lithuania · Hybrid`. */
function placeFromLine(line: string): Place {
  const parts = line
    .split(/[,·|()/•–—]|\s-\s/)
    .map((p) => p.trim())
    .filter(Boolean);
  // Each comma-separated part is tried whole first (`New York`), then word by
  // word, so `Vilnius, Vilnius County, Lithuania` still lands on both.
  const whole = placeFromTokens(parts);
  const split = placeFromTokens(
    parts.flatMap((p) => p.split(/\s+/)),
    { loose: true },
  );
  return {
    city: whole.city ?? split.city,
    country: whole.country ?? split.country,
    job_type: whole.job_type ?? split.job_type,
  };
}

/* ------------------------------------------------------------------ *
 * Names out of URL slugs
 * ------------------------------------------------------------------ */

const ACRONYMS = new Set([
  "ai",
  "ml",
  "ui",
  "ux",
  "qa",
  "hr",
  "it",
  "seo",
  "vp",
  "cto",
  "ceo",
  "cfo",
  "coo",
  "cpo",
  "sre",
  "bi",
  "crm",
  "erp",
  "api",
  "ios",
  "saas",
  "b2b",
  "b2c",
  "emea",
  "apac",
]);
const SMALL_WORDS = new Set(["and", "of", "the", "for", "in", "at", "to", "a", "an", "with", "on"]);

function decode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** `senior-product-manager` → `Senior Product Manager`; already-cased slugs keep their case. */
function titleFromSlug(slug: string): string | null {
  const words = decode(slug)
    .replace(/[-_+\s]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (words.length === 0 || !/[a-z]/i.test(slug)) return null;
  const cased = /[A-Z]/.test(slug);
  const title = words
    .map((w, i) => {
      if (cased) return w;
      if (ACRONYMS.has(w)) return w.toUpperCase();
      if (i > 0 && SMALL_WORDS.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
  return title.length <= 120 ? title : null;
}

/** `acme-corp` → `Acme Corp`; `BoschGroup` stays as written. */
function nameFromSlug(slug: string | undefined): string | null {
  if (!slug) return null;
  const name = decode(slug).replace(/[-_]+/g, " ").trim();
  if (!name || /^\d+$/.test(name)) return null;
  return /[A-Z]/.test(name) ? name : name.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

/* ------------------------------------------------------------------ *
 * Links
 * ------------------------------------------------------------------ */

/**
 * Applicant-tracking systems: the employer is named in the URL, but the host
 * is the vendor's, so it says nothing about the company's own website.
 */
const ATS_HOST =
  /(?:^|\.)(?:greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|myworkdayjobs\.com|myworkdaysite\.com|smartrecruiters\.com|recruitee\.com|teamtailor\.com|personio\.(?:de|com)|bamboohr\.com|breezy\.hr|jobvite\.com|icims\.com|taleo\.net|successfactors\.(?:com|eu)|pinpointhq\.com|comeet\.com|rippling\.com|homerun\.co|join\.com|jazzhr\.com|applytojob\.com)$/i;

/** Job boards and aggregators: neither the host nor the path is the employer. */
const BOARD_HOST =
  /(?:^|\.)(?:linkedin\.com|indeed\.[a-z.]+|glassdoor\.[a-z.]+|cvbankas\.lt|cv\.lt|cvonline\.lt|cvmarket\.lt|cv\.ee|cv\.lv|stepstone\.[a-z.]+|monster\.[a-z.]+|wellfound\.com|angel\.co|otta\.com|welcometothejungle\.com|remoteok\.com|weworkremotely\.com|xing\.com|totaljobs\.com|reed\.co\.uk|seek\.com\.au|ziprecruiter\.com|dice\.com|builtin\.com|google\.[a-z.]+|jobs\.ch|jobindex\.dk|pracuj\.pl|nofluffjobs\.com|justjoin\.it|europa\.eu|himalayas\.app|remotive\.com|workingnomads\.com)$/i;

/** Paths that look like a single posting rather than a homepage. */
const POSTING_PATH = /\/(?:jobs?|careers?|positions?|vacanc|openings?|apply|o|p|j)\b/i;

/** `careers.acme.co.uk` → `acme.co.uk`. Naive about suffixes, right about the common ones. */
function registrableDomain(host: string): string {
  const labels = host.replace(/^www\./, "").split(".");
  if (labels.length <= 2) return labels.join(".");
  const tld = labels[labels.length - 1];
  const sld = labels[labels.length - 2];
  const keep = tld.length === 2 && /^(?:co|com|org|net|gov|ac|edu)$/.test(sld) ? 3 : 2;
  return labels.slice(-keep).join(".");
}

function toUrl(raw: string): URL | null {
  const trimmed = raw.trim().replace(/[.,;)\]]+$/, "");
  if (!trimmed || /\s/.test(trimmed)) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (!/^https?:$/.test(url.protocol)) return null;
    if (!/\.[a-z]{2,}$/i.test(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

const segmentsOf = (url: URL) => url.pathname.split("/").filter(Boolean);

/** Workday requisition ids: `_R0012345`, `_JR-123456`, `_2024-1234`. */
const WORKDAY_REQ = /_(?:[A-Za-z]{0,4}-?)?\d[\d-]*$/;

/** The posting's own id at the front of a slug: `744000-product-manager`. */
const LEADING_ID = /^[\da-f]{6,}-|^\d+-/i;

/**
 * Read what a job link gives away about the role. Known applicant-tracking
 * systems put the employer (and sometimes the title and office) in the path;
 * a link on the employer's own domain gives the website for the logo.
 */
export function readJobLink(raw: string): LinkFill {
  const url = toUrl(raw);
  if (!url) return EMPTY_LINK;
  const host = url.hostname.toLowerCase();
  const sub = host.split(".")[0];
  const segs = segmentsOf(url);
  const out: LinkFill = { ...EMPTY_LINK };

  if (/myworkday(?:jobs|site)\.com$/.test(host)) {
    out.company = nameFromSlug(sub);
    const at = segs.indexOf("job");
    const [place, slug] = at === -1 ? [] : segs.slice(at + 1);
    // `/job/Lithuania---Vilnius/AI-Platform-Product-Manager_R0012345`, or
    // with no location segment, `/job/AI-Platform-Product-Manager_R0012345`.
    const titleSlug = slug ?? place;
    if (titleSlug) out.position = titleFromSlug(titleSlug.replace(WORKDAY_REQ, ""));
    if (slug && place) Object.assign(out, placeFromTokens(decode(place).split(/-+/)));
    return out;
  }
  if (/(?:^|\.)greenhouse\.io$/.test(host)) {
    out.company = nameFromSlug(segs[0] === "embed" ? (url.searchParams.get("for") ?? "") : segs[0]);
    return out;
  }
  if (/(?:^|\.)(?:lever\.co|ashbyhq\.com)$/.test(host) || host === "apply.workable.com") {
    out.company = nameFromSlug(segs[0]);
    return out;
  }
  if (host === "jobs.smartrecruiters.com") {
    out.company = nameFromSlug(segs[0]);
    if (segs[1]) out.position = titleFromSlug(segs[1].replace(LEADING_ID, ""));
    return out;
  }
  if (/\.(?:recruitee\.com|teamtailor\.com|breezy\.hr)$/.test(host)) {
    out.company = nameFromSlug(sub);
    const slug = segs[0] === "o" || segs[0] === "jobs" || segs[0] === "p" ? segs[1] : null;
    if (slug) out.position = titleFromSlug(slug.replace(LEADING_ID, ""));
    return out;
  }
  if (/\.(?:workable\.com|personio\.(?:de|com)|bamboohr\.com)$/.test(host)) {
    out.company = nameFromSlug(sub);
    return out;
  }
  if (/(?:^|\.)linkedin\.com$/.test(host)) {
    // Only the long form carries anything: /jobs/view/product-manager-at-nasdaq-4012345678
    const slug = segs[0] === "jobs" && segs[1] === "view" ? segs[2] : null;
    const m = slug?.match(/^(.+)-at-(.+)-\d+$/);
    if (m) {
      out.position = titleFromSlug(m[1]);
      out.company = nameFromSlug(m[2]);
    }
    return out;
  }
  if (ATS_HOST.test(host) || BOARD_HOST.test(host)) return out;

  // The employer's own site — careers.acme.com, acme.com/careers/123.
  const domain = registrableDomain(host);
  out.website = domain;
  out.company = nameFromSlug(domain.split(".")[0]);
  return out;
}

/** The first URL in a pasted ad that points at a posting, not a homepage or a social profile. */
function findPostingUrl(text: string): string | null {
  for (const match of text.matchAll(/https?:\/\/[^\s<>"'`]+/gi)) {
    const url = toUrl(match[0]);
    if (!url) continue;
    const host = url.hostname.toLowerCase();
    if (ATS_HOST.test(host) || POSTING_PATH.test(url.pathname)) return url.toString();
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Text
 * ------------------------------------------------------------------ */

const LABEL = String.raw`\s*[:：]\s*(.{2,100})$`;
const COMPANY_LINE = new RegExp(
  `^(?:company|company name|employer|organi[sz]ation|hiring company|įmonė|darbdavys)${LABEL}`,
  "i",
);
const POSITION_LINE = new RegExp(
  `^(?:job title|position|position title|role|title|vacancy|pareigos|pozicija)${LABEL}`,
  "i",
);
const LOCATION_LINE = new RegExp(
  `^(?:location|job location|locations|based in|office|office location|city|workplace|work location|darbo vieta|vieta|miestas)${LABEL}`,
  "i",
);
const WORK_MODE_LINE = new RegExp(
  `^(?:work mode|workplace type|work model|working model|remote|darbo pobūdis)${LABEL}`,
  "i",
);

/**
 * A labelled value that is a name, not the start of a paragraph. A full stop
 * is fine on a short name (`Acme Inc.`), not at the end of a sentence.
 */
const looksLikeName = (v: string) =>
  v.length <= 80 &&
  !/https?:/.test(v) &&
  !/[!?]$/.test(v) &&
  !(v.endsWith(".") && v.split(/\s+/).length > 4);

const HYBRID = /\bhybrid\b|hibridin/i;
const STRONG_REMOTE =
  /\b(?:fully remote|100% remote|remote[- ](?:first|only)|work from anywhere|remote position|remote role|remote job)\b|nuotolini/i;
const ONSITE =
  /\b(?:on[- ]?site|in[- ]office|office[- ]based|in the office \d|5 days in the office)\b/i;

/**
 * Remote, hybrid or on-site, if the ad says so plainly. Hybrid wins because
 * hybrid ads talk about both the office and remote days; a bare "remote" is
 * not enough on its own, since plenty of office jobs mention remote Fridays.
 */
function workModeFrom(text: string): JobType | null {
  if (HYBRID.test(text)) return "hybrid";
  if (STRONG_REMOTE.test(text)) return "remote";
  if (ONSITE.test(text)) return "onsite";
  return null;
}

/**
 * Pull company, title and place out of the top of an ad. Labelled lines win
 * (`Location: Vilnius`); after that, short lines near the top that read as a
 * place (`Vilnius, Lithuania · 2 weeks ago`), and a `Title at Company` line.
 */
function readText(text: string) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const head = lines.slice(0, 25);

  let company: string | null = null;
  let position: string | null = null;
  let place: Place = { city: null, country: null, job_type: null };
  let mode: JobType | null = null;

  for (const line of lines.slice(0, 60)) {
    const c = line.match(COMPANY_LINE)?.[1]?.trim();
    if (c && !company && looksLikeName(c)) company = c;
    const p = line.match(POSITION_LINE)?.[1]?.trim();
    if (p && !position && looksLikeName(p)) position = p;
    const l = line.match(LOCATION_LINE)?.[1]?.trim();
    if (l && !place.city && !place.country) place = placeFromLine(l);
    const m = line.match(WORK_MODE_LINE)?.[1]?.trim();
    if (m && !mode) mode = workModeFrom(m) ?? (/^(?:yes|remote)/i.test(m) ? "remote" : null);
  }

  if (!position) {
    const headline = head
      .slice(0, 3)
      .map((l) => l.match(/^(.{3,80}?)\s+(?:at|@)\s+(.{2,60})$/i))
      .find(Boolean);
    if (headline && looksLikeName(headline[2])) {
      position = headline[1].trim();
      company ??= headline[2].trim();
    }
  }

  // Short lines near the top that name a place or a work mode: the location
  // row every job board prints under the title (`Vilnius, Lithuania · Hybrid`).
  // Long lines are prose and are skipped.
  let headMode: JobType | null = null;
  for (const line of head) {
    if (line.length > 120) continue;
    const found = placeFromLine(line);
    if ((found.city || found.country) && !place.city && !place.country) {
      place = { ...found, job_type: place.job_type };
    }
    headMode ??= found.job_type;
  }

  return {
    company,
    position,
    city: place.city,
    country: place.country,
    job_type: mode ?? place.job_type ?? headMode ?? workModeFrom(text.slice(0, 4000)),
  };
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

/**
 * Read a paste in one call. A lone link is read as a link; anything else is
 * read as the ad itself, with any posting link inside it read too. What the
 * ad says outright beats what its URL suggests.
 */
export function readQuickFill(raw: string): QuickFill {
  const trimmed = raw.trim();
  const lone = toUrl(trimmed);
  if (lone) {
    return { ...readJobLink(trimmed), job_url: lone.toString(), ad: null };
  }

  const ad = parseJobAd(trimmed);
  const job_url = findPostingUrl(trimmed);
  const link = job_url ? readJobLink(job_url) : EMPTY_LINK;
  const text = readText(ad.description);

  return {
    company: text.company ?? link.company,
    position: text.position ?? link.position,
    website: link.website,
    job_url,
    job_type: text.job_type ?? link.job_type,
    city: text.city ?? link.city,
    country: text.country ?? link.country,
    ad,
  };
}
