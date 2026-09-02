/**
 * Job-ad capture: read a pasted posting well enough to fill the salary and
 * requirements fields, and format a band back out for display.
 *
 * Everything here is pure and dependency-free on purpose. The browser
 * extension is built from this same module, so a parser improvement lands in
 * both surfaces at once and the two can never drift apart.
 *
 * The parser is a convenience; the archive is the product. Callers must store
 * the cleaned text whether or not extraction succeeded, and must show every
 * extracted value for confirmation before saving it — a wrong salary written
 * silently is worse than an empty field, because it turns a known-unknown into
 * a false certainty someone acts on months later.
 */

export const SALARY_PERIODS = ["year", "month", "week", "day", "hour"] as const;
export type SalaryPeriod = (typeof SALARY_PERIODS)[number];

export const SALARY_SOURCES = ["posted", "recruiter", "estimate"] as const;
export type SalarySource = (typeof SALARY_SOURCES)[number];

export const SALARY_PERIOD_META: Record<SalaryPeriod, { label: string; short: string }> = {
  year: { label: "Per year", short: "yr" },
  month: { label: "Per month", short: "mo" },
  week: { label: "Per week", short: "wk" },
  day: { label: "Per day", short: "day" },
  hour: { label: "Per hour", short: "hr" },
};

export const SALARY_SOURCE_META: Record<SalarySource, { label: string; hint: string }> = {
  posted: { label: "Posted", hint: "Printed in the job ad." },
  recruiter: { label: "From a recruiter", hint: "Said on a call or in an email." },
  estimate: { label: "My estimate", hint: "A guess, not a quoted figure." },
};

export type SalaryFields = {
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: SalaryPeriod | null;
};

export type SalaryGuess = SalaryFields & {
  /** The exact substring the numbers were read from, so the UI can show its work. */
  match: string;
  /** `low` when the period or currency had to be inferred rather than read. */
  confidence: "high" | "low";
};

/* ------------------------------------------------------------------ *
 * Currency
 * ------------------------------------------------------------------ */

/** Symbols that map to exactly one currency in practice. */
const SYMBOL_CURRENCY: [symbol: string, code: string][] = [
  ["€", "EUR"],
  ["£", "GBP"],
  ["₹", "INR"],
  ["₪", "ILS"],
  ["₴", "UAH"],
  ["zł", "PLN"],
  ["Kč", "CZK"],
  ["CHF", "CHF"],
];

/** ISO 4217 codes worth recognising, weighted to the markets the app covers. */
export const CURRENCY_CODES = [
  "EUR",
  "USD",
  "GBP",
  "PLN",
  "SEK",
  "NOK",
  "DKK",
  "CHF",
  "CZK",
  "HUF",
  "RON",
  "BGN",
  "INR",
  "JPY",
  "CAD",
  "AUD",
  "NZD",
  "SGD",
  "ZAR",
  "BRL",
  "MXN",
  "TRY",
  "UAH",
  "ILS",
  "AED",
  "HRK",
  "ISK",
];

/**
 * Which currency a window of text is quoting, or null.
 *
 * `$` is deliberately resolved by its prefix — a bare `$` is USD, but `C$`,
 * `A$` and `NZ$` are common enough in postings to be worth reading. `kr` is
 * left out entirely: it is SEK, NOK, DKK and ISK depending on the country, and
 * guessing wrong is worse than asking.
 */
function detectCurrency(window: string): string | null {
  const code = window.toUpperCase().match(new RegExp(`\\b(${CURRENCY_CODES.join("|")})\\b`));
  if (code) return code[1];

  for (const [symbol, currency] of SYMBOL_CURRENCY) {
    if (window.includes(symbol)) return currency;
  }

  const dollar = window.match(/(C|A|NZ|US)?\s?\$/i);
  if (dollar) {
    const prefix = (dollar[1] ?? "").toUpperCase();
    return prefix === "C" ? "CAD" : prefix === "A" ? "AUD" : prefix === "NZ" ? "NZD" : "USD";
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Numbers
 * ------------------------------------------------------------------ */

/**
 * A number as written in an ad: 65,000 · 65.000 · 65 000 · 65000 · 65k · 1,234.56
 *
 * The grouped branch requires at least one separator (`+`, not `*`). With `*`
 * it matched only the first three digits of an unseparated number and stopped,
 * so "65000 - 80000" tokenised as "650" and no salary was found at all — while
 * the identical band written "65,000 - 80,000" read fine.
 */
const NUMBER = String.raw`\d{1,3}(?:[.,\u00A0\u202F ]\d{3})+(?:[.,]\d{1,2})?k?|\d+(?:[.,]\d{1,2})?k?`;

/**
 * Turn an ad's number into a real one.
 *
 * The separator trap: `65.000` is sixty-five thousand in Vilnius and sixty-five
 * in Boston, and this app's city list leans European, so locale can't be
 * assumed. Resolve it structurally instead — a separator followed by exactly
 * three digits, in a repeating group, is a thousands separator; a single
 * separator with one or two trailing digits is a decimal point.
 */
export function parseAmount(raw: string): number | null {
  const token = raw.trim().replace(/[\u00A0\u202F]/g, " ");
  const hasK = /k$/i.test(token);
  const body = hasK ? token.slice(0, -1).trim() : token;

  let normalised: string;
  if (/^\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{1,2})?$/.test(body)) {
    // Grouped thousands, optionally with a decimal tail. The last separator is
    // a decimal point only when it is followed by one or two digits.
    const decimal = body.match(/[.,](\d{1,2})$/);
    const whole = decimal ? body.slice(0, decimal.index) : body;
    normalised = whole.replace(/[.,\s]/g, "") + (decimal ? `.${decimal[1]}` : "");
  } else if (/^\d+[.,]\d{1,2}$/.test(body)) {
    normalised = body.replace(",", ".");
  } else if (/^\d+$/.test(body)) {
    normalised = body;
  } else {
    return null;
  }

  const value = Number(normalised);
  if (!Number.isFinite(value)) return null;
  return hasK ? Math.round(value * 1000) : value;
}

/* ------------------------------------------------------------------ *
 * Language packs
 * ------------------------------------------------------------------ */

/**
 * Everything in this file that depends on the language of the ad.
 *
 * Adding a language is a data change: append a pack below and every regex
 * derived from it picks the terms up. Entries are regex fragments, not literal
 * strings, so `m[eė]n\.?` covers both spellings — keep them anchored to whole
 * words by the builders rather than adding \b here.
 *
 * English and Lithuanian ship today. The two behave differently in ways that
 * matter: Lithuanian ads usually quote a *monthly* figure, write ranges as
 * "nuo X iki Y", and mark gross pay with "neatskaičius mokesčių".
 */
type LanguagePack = {
  /** Joins the two ends of a range: "to", "iki". */
  rangeJoin: string[];
  /** Marks the number that follows as a ceiling rather than a floor. */
  ceiling: string[];
  period: Record<SalaryPeriod, string[]>;
  /** Near a number, these mean it is pay. */
  salaryWords: string[];
  /** Near a number, these mean it is not. */
  notSalaryWords: string[];
  requirementHeadings: string[];
  closingHeadings: string[];
  /** Whole lines of job-board furniture, dropped from a captured ad. */
  chromeLines: string[];
};

const LANGUAGES: LanguagePack[] = [
  // ---- English ----
  {
    rangeJoin: ["to", "and", "up\\s+to"],
    ceiling: ["up\\s+to"],
    period: {
      year: [
        "per\\s+year",
        "per\\s+annum",
        "p\\.\\s?a\\.(?![a-z])",
        "annual(?:ly)?",
        "a\\s+year",
        "/\\s?(?:yr|year)",
      ],
      month: ["per\\s+month", "monthly", "a\\s+month", "/\\s?(?:mo|month)"],
      week: ["per\\s+week", "weekly", "a\\s+week", "/\\s?(?:wk|week)"],
      day: ["per\\s+day", "day\\s+rate", "daily", "a\\s+day", "/\\s?day"],
      hour: ["per\\s+hour", "hourly", "an\\s+hour", "/\\s?(?:hr|hour)"],
    },
    salaryWords: [
      "salary",
      "compensation",
      "remuneration",
      "pay",
      "paid",
      "base",
      "package",
      "OTE",
      "earn",
      "wage",
      "rate",
      "budget",
      "range",
      "bracket",
      "gross",
      "net",
    ],
    notSalaryWords: [
      "employees",
      "customers",
      "users",
      "revenue",
      "funding",
      "raised",
      "valuation",
      "founded",
      "clients",
      "countries",
      "team\\s+of",
      "arr",
      "series\\s+[a-e]",
      "applicants",
    ],
    requirementHeadings: [
      "(?:the\\s+)?requirements?",
      "qualifications?",
      "what\\s+you(?:'|’)?ll\\s+bring",
      "what\\s+we(?:'|’)?re\\s+looking\\s+for",
      "who\\s+you\\s+are",
      "about\\s+you",
      "you\\s+(?:have|will\\s+have|bring)",
      "must[-\\s]haves?",
      "nice[-\\s]to[-\\s]haves?",
      "skills?(?:\\s*(?:&|and)\\s*experience)?",
      "your\\s+(?:profile|experience|background)",
      "we(?:'|’)?d\\s+love\\s+to\\s+see",
      "minimum\\s+qualifications?",
      "basic\\s+qualifications?",
    ],
    closingHeadings: [
      "benefits?",
      "what\\s+we\\s+offer",
      "(?:the\\s+)?perks?",
      "compensation(?:\\s*(?:&|and)\\s*benefits)?",
      "salary",
      "about\\s+(?:us|the\\s+company|the\\s+team)",
      "why\\s+(?:join|us|work)",
      "how\\s+to\\s+apply",
      "application\\s+process",
      "(?:our\\s+)?(?:hiring|interview)\\s+process",
      "equal\\s+opportunit\\w*",
      "diversity",
      "privacy",
      "next\\s+steps?",
    ],
    chromeLines: [
      "sign\\s+in",
      "sign\\s+up",
      "log\\s?in",
      "join\\s+now",
      "easy\\s+apply",
      "apply\\s+now",
      "save(?:\\s+job)?",
      "saved",
      "share",
      "show\\s+(?:more|less)",
      "see\\s+more",
      "read\\s+more",
      "report\\s+(?:this\\s+)?job",
      "people\\s+also\\s+viewed",
      "similar\\s+jobs",
      "more\\s+jobs",
      "jobs\\s+you\\s+may\\s+be\\s+interested\\s+in",
      "back\\s+to\\s+(?:search|jobs)",
      "skip\\s+to\\s+(?:main\\s+)?content",
      "accept\\s+(?:all\\s+)?cookies",
      "cookie\\s+(?:policy|settings|preferences)",
      "manage\\s+preferences",
      "we\\s+use\\s+cookies",
    ],
  },
  // ---- Lithuanian ----
  {
    rangeJoin: ["iki"],
    ceiling: ["iki"],
    period: {
      year: ["per\\s+metus", "metinis", "kasmet", "/\\s?met\\.?", "eur/met"],
      month: [
        "per\\s+m[eė]nes[iį]",
        "m[eė]nesinis",
        "kas\\s+m[eė]nes[iį]",
        "/\\s?m[eė]n\\.?",
        "m[eė]n\\.",
      ],
      week: ["per\\s+savait[eę]", "savaitinis", "/\\s?sav\\.?"],
      day: ["per\\s+dien[aą]", "dienos\\s+[iį]kainis", "/\\s?d\\.?"],
      hour: ["per\\s+valand[aą]", "valandinis", "/\\s?val\\.?", "val\\."],
    },
    salaryWords: [
      "atlyginimas",
      "atlyginim[aą]",
      "atlygis",
      "alga",
      "u[zž]mokestis",
      "darbo\\s+u[zž]mokestis",
      "neatskai[cč]ius\\s+mokes[cč]i[uų]",
      "[iį]\\s+rankas",
      "bruto",
      "neto",
      "nuo",
    ],
    notSalaryWords: [
      "darbuotoj",
      "[sš]alyse",
      "apyvarta",
      "pajamos",
      "[iį]steigta",
      "investicij",
      "kandidat[uų]",
    ],
    requirementHeadings: [
      "reikalavimai(?:\\s+kandidatui)?",
      "ko\\s+tikim[eė]s",
      "ko\\s+i[sš]\\s+j[uū]s[uų]\\s+tikim[eė]s",
      "j[uū]s[uų]\\s+profilis",
      "j[uū]s[uų]\\s+patirtis",
      "tikim[eė]s",
      "kvalifikacija",
      "b[uū]tina",
      "privalumai",
      "k[aą]\\s+turite\\s+mok[eė]ti",
    ],
    closingHeadings: [
      "(?:m[eė]s\\s+)?si[uū]lome",
      "k[aą]\\s+m[eė]s\\s+si[uū]lome",
      "m[uū]s[uų]\\s+pasi[uū]lymas",
      "apie\\s+(?:mus|[iį]mon[eę]|komand[aą])",
      "kandidatavimas",
      "kandidatuoti",
      "papildoma\\s+informacija",
      "atlyginimas",
      "darbo\\s+u[zž]mokestis",
      "duomen[uų]\\s+apsauga",
    ],
    chromeLines: [
      "prisijungti",
      "registruotis",
      "kandidatuoti",
      "i[sš]saugoti",
      "i[sš]saugota",
      "rodyti\\s+(?:daugiau|ma[zž]iau)",
      "daugiau",
      "pana[sš][uū]s\\s+skelbimai",
      "pana[sš][uū]s\\s+darbo\\s+pasi[uū]lymai",
      "gr[iį][zž]ti",
      "dalintis",
      "prane[sš]ti\\s+apie\\s+skelbim[aą]",
      "sutinku",
      "slapukai",
      "slapuk[uų]\\s+nustatymai",
    ],
  },
];

/** `(?:a|b|c)` from every pack's entries for one field. */
function alt(pick: (pack: LanguagePack) => string[]): string {
  const terms = LANGUAGES.flatMap(pick);
  return `(?:${terms.join("|")})`;
}

/* ------------------------------------------------------------------ *
 * Period
 * ------------------------------------------------------------------ */

const PERIOD_PATTERNS: [pattern: RegExp, period: SalaryPeriod][] = SALARY_PERIODS.map((period) => [
  new RegExp(
    alt((pack) => pack.period[period]),
    "i",
  ),
  period,
]);

function detectPeriod(window: string): SalaryPeriod | null {
  for (const [pattern, period] of PERIOD_PATTERNS) {
    if (pattern.test(window)) return period;
  }
  return null;
}

/**
 * Fall back to the magnitude when the ad never says the period. Ads that quote
 * a yearly figure often leave "per year" implied, so this is worth doing — but
 * it is a guess, and the caller downgrades confidence when it fires.
 */
function inferPeriod(amount: number): SalaryPeriod {
  if (amount >= 10000) return "year";
  if (amount >= 1000) return "month";
  if (amount >= 400) return "day";
  return "hour";
}

/* ------------------------------------------------------------------ *
 * Salary
 * ------------------------------------------------------------------ */

const RANGE_SEPARATOR = `\\s*(?:-|–|—|‑|${alt((p) => p.rangeJoin)})\\s*`;
const CURRENCY_MARK = String.raw`(?:[€£₹₪₴$]|zł|Kč|CHF|EUR|USD|GBP|PLN|SEK|NOK|DKK|CZK|HUF|RON|BGN|INR|JPY|CAD|AUD|NZD|SGD|ZAR|BRL|MXN|TRY|UAH|ILS|AED)`;

/** Words that mean "the number near here is pay, not headcount or revenue". */
const SALARY_KEYWORD = new RegExp(`\\b${alt((p) => p.salaryWords)}`, "i");

/** Words that mean the opposite — a number near these is almost never pay. */
const NEGATIVE_KEYWORD = new RegExp(`\\b${alt((p) => p.notSalaryWords)}`, "i");

type Candidate = {
  index: number;
  text: string;
  min: number | null;
  max: number | null;
};

/** Every plausible money mention in the text, in document order. */
function findCandidates(text: string): Candidate[] {
  const bounded = String.raw`(?:${CURRENCY_MARK}\s*)?(${NUMBER})\s*(?:${CURRENCY_MARK})?`;
  const pattern = new RegExp(`${bounded}(?:${RANGE_SEPARATOR}${bounded})?`, "gi");
  const found: Candidate[] = [];

  for (const match of text.matchAll(pattern)) {
    const first = parseAmount(match[1] ?? "");
    if (first === null) continue;
    const second = match[2] === undefined ? null : parseAmount(match[2]);

    // A lone "5" or a year like 2026 is noise until something else vouches for it.
    if (second === null && (first < 100 || /^(19|20)\d{2}$/.test((match[1] ?? "").trim()))) {
      continue;
    }

    found.push({
      index: match.index,
      text: match[0].trim(),
      min: second === null ? first : Math.min(first, second),
      max: second === null ? null : Math.max(first, second),
    });
  }
  return found;
}

/** How strongly a candidate looks like the ad's salary, given its surroundings. */
function scoreCandidate(text: string, candidate: Candidate): number {
  const window = text.slice(
    Math.max(0, candidate.index - 90),
    candidate.index + candidate.text.length + 60,
  );

  let score = 0;
  if (detectCurrency(candidate.text)) score += 5;
  else if (detectCurrency(window)) score += 2;
  if (detectPeriod(window)) score += 4;
  if (SALARY_KEYWORD.test(window)) score += 4;
  if (NEGATIVE_KEYWORD.test(window)) score -= 6;
  if (candidate.max !== null) score += 3;
  // Pay is quoted in round-ish figures; headcounts and version numbers aren't.
  if (candidate.min !== null && candidate.min >= 1000) score += 2;
  return score;
}

/**
 * Best guess at the salary in a pasted ad, or null when nothing convincing
 * turns up. Never throws — a pathological paste yields null, not an error.
 */
export function parseSalary(text: string): SalaryGuess | null {
  if (!text || text.length > 400_000) return null;

  const candidates = findCandidates(text);
  if (candidates.length === 0) return null;

  let best: Candidate | null = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const score = scoreCandidate(text, candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  // Below this, we're reading tea leaves — better to leave the fields empty
  // and let the user paste the number themselves.
  if (!best || bestScore < 7) return null;

  const window = text.slice(Math.max(0, best.index - 90), best.index + best.text.length + 60);
  const currency = detectCurrency(best.text) ?? detectCurrency(window);
  const readPeriod = detectPeriod(window);

  // With neither a currency nor a stated period, the only thing vouching for
  // these digits is a nearby word like "range" or "rate" — which is how "4 - 8"
  // out of a sidebar once became a salary of 4–8 per hour. Small bare numbers
  // are rejected outright; large ones are still plausibly a band.
  if (!currency && !readPeriod && (best.min ?? 0) < 1000) return null;

  const period = readPeriod ?? (best.min !== null ? inferPeriod(best.min) : null);

  // "up to 80k" is a ceiling, not a floor.
  const ceilingOnly = best.max === null && /up\s+to\s*$/i.test(text.slice(0, best.index + 4));

  return {
    salary_min: ceilingOnly ? null : best.min,
    salary_max: ceilingOnly ? best.min : best.max,
    salary_currency: currency,
    salary_period: period,
    match: best.text,
    confidence: currency && readPeriod ? "high" : "low",
  };
}

/* ------------------------------------------------------------------ *
 * Requirements
 * ------------------------------------------------------------------ */

/** Headings that open the "what we need from you" part of an ad. */
const REQUIREMENT_HEADING = new RegExp(
  `^[\\s#*\\-•>]*${alt((p) => p.requirementHeadings)}\\s*[:.]?\\s*$`,
  "i",
);

/** Headings that close it — everything after these is not a requirement. */
const CLOSING_HEADING = new RegExp(
  `^[\\s#*\\-•>]*${alt((p) => p.closingHeadings)}\\s*[:.]?\\s*$`,
  "i",
);

/**
 * Pull the requirements section out of an ad body.
 *
 * Returns null when no recognisable heading is present — better an empty field
 * than a arbitrary half of the ad copied into it.
 */
export function splitRequirements(text: string): string | null {
  if (!text) return null;
  const lines = text.split(/\r?\n/);

  const start = lines.findIndex((line) => REQUIREMENT_HEADING.test(line));
  if (start === -1) return null;

  const rest = lines.slice(start + 1);
  let end = rest.findIndex((line) => CLOSING_HEADING.test(line));
  if (end === -1) end = rest.length;

  const section = rest
    .slice(0, end)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // A heading with a couple of words under it caught the wrong thing — but a
  // real list can be two short bullets, so the floor is low.
  return section.length >= 20 ? section : null;
}

/* ------------------------------------------------------------------ *
 * Cleaning
 * ------------------------------------------------------------------ */

/**
 * Job-board chrome that rides along on a copy-paste. Matched against whole
 * trimmed lines only, so a sentence that merely contains one of these words
 * survives — this removes furniture, never ad copy.
 */
const CHROME_LINE = new RegExp(`^(?:${alt((p) => p.chromeLines)}|·|•|—|-{2,})$`, "i");

/**
 * Normalise a pasted ad into something worth reading six weeks later:
 * drop board furniture, collapse runaway blank lines, trim the edges.
 * Ad content is never removed — only known chrome lines.
 */
export function cleanAdText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00A0\u202F]/g, " ")
    .split("\n")
    .filter((line) => !CHROME_LINE.test(line.trim()))
    .join("\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ------------------------------------------------------------------ *
 * Whole-ad parse
 * ------------------------------------------------------------------ */

export type ParsedAd = {
  description: string;
  requirements: string | null;
  salary: SalaryGuess | null;
};

/**
 * Read a pasted ad in one call.
 *
 * `requirements` is a copy of a slice of `description`, not a cut from it —
 * the description stays whole so the archive is faithful, and the duplication
 * is cheaper than a description with a hole in the middle.
 */
export function parseJobAd(raw: string): ParsedAd {
  const description = cleanAdText(raw);
  return {
    description,
    requirements: splitRequirements(description),
    salary: parseSalary(description),
  };
}

/* ------------------------------------------------------------------ *
 * Display
 * ------------------------------------------------------------------ */

const CURRENCY_SYMBOL: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  INR: "₹",
  ILS: "₪",
  UAH: "₴",
  PLN: "zł",
  CZK: "Kč",
  JPY: "¥",
  CAD: "C$",
  AUD: "A$",
  NZD: "NZ$",
};

/** `65000` → `65k`, `1500` → `1.5k`, `85` → `85`. */
function compact(amount: number): string {
  if (amount < 1000) return String(amount);
  const thousands = amount / 1000;
  const rounded = Math.round(thousands * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}k`;
}

function withCurrency(amount: number, currency: string | null): string {
  const value = compact(amount);
  if (!currency) return value;
  const symbol = CURRENCY_SYMBOL[currency];
  return symbol ? `${symbol}${value}` : `${value} ${currency}`;
}

/**
 * One salary formatter for the card chip, the list row and the detail page —
 * `€65–80k / yr`, `Up to £90k / yr`, `From $120k`. Returns null when there is
 * no number to show, so callers can render nothing at all.
 */
export function formatSalary(fields: Partial<SalaryFields>): string | null {
  const { salary_min: min, salary_max: max, salary_currency: currency = null } = fields;
  const period = fields.salary_period ? SALARY_PERIOD_META[fields.salary_period].short : null;
  const suffix = period ? ` / ${period}` : "";

  if (min != null && max != null) {
    // One currency mark and one magnitude suffix for the pair, not two of each:
    // €65–80k, never €65k–€80k.
    const symbol = currency ? CURRENCY_SYMBOL[currency] : null;
    const tail = compact(max);
    let head = compact(min);
    if (head.endsWith("k") && tail.endsWith("k")) head = head.slice(0, -1);
    const trailing = !symbol && currency ? ` ${currency}` : "";
    return `${symbol ?? ""}${head}–${tail}${trailing}${suffix}`;
  }
  if (min != null) return `From ${withCurrency(min, currency)}${suffix}`;
  if (max != null) return `Up to ${withCurrency(max, currency)}${suffix}`;
  return null;
}
