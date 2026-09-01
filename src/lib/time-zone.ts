/**
 * How far away a role is in hours, and whether your working days actually
 * overlap.
 *
 * The offset is never stored. It is derived at render time from an IANA zone
 * id, because offsets move twice a year and a number written into the database
 * in January is wrong by March. Everything here takes a `Date` so the caller
 * controls "now" and the results stay testable.
 *
 * Zones are resolved from the location the application already records. The
 * city list in {@link CITIES} is curated and finite, so this is a lookup table
 * rather than a geocoding dependency.
 */
import { CITIES, countryCode } from "./job-location";

/**
 * One representative zone per country in the city list.
 *
 * "Representative" is exact for single-zone countries, which is most of them.
 * Countries that genuinely span zones are listed here with their business
 * centre and then corrected per-city in {@link CITY_ZONE_OVERRIDES} — the
 * fallback only applies when a role records a country but no city.
 */
const COUNTRY_ZONE: Record<string, string> = {
  AE: "Asia/Dubai",
  AL: "Europe/Tirane",
  AM: "Asia/Yerevan",
  AR: "America/Argentina/Buenos_Aires",
  AT: "Europe/Vienna",
  AU: "Australia/Sydney",
  BA: "Europe/Sarajevo",
  BE: "Europe/Brussels",
  BG: "Europe/Sofia",
  BR: "America/Sao_Paulo",
  BY: "Europe/Minsk",
  CA: "America/Toronto",
  CH: "Europe/Zurich",
  CL: "America/Santiago",
  CN: "Asia/Shanghai",
  CO: "America/Bogota",
  CY: "Asia/Nicosia",
  CZ: "Europe/Prague",
  DE: "Europe/Berlin",
  DK: "Europe/Copenhagen",
  EE: "Europe/Tallinn",
  EG: "Africa/Cairo",
  ES: "Europe/Madrid",
  FI: "Europe/Helsinki",
  FR: "Europe/Paris",
  GB: "Europe/London",
  GE: "Asia/Tbilisi",
  GR: "Europe/Athens",
  HK: "Asia/Hong_Kong",
  HR: "Europe/Zagreb",
  HU: "Europe/Budapest",
  ID: "Asia/Jakarta",
  IE: "Europe/Dublin",
  IL: "Asia/Jerusalem",
  IN: "Asia/Kolkata",
  IS: "Atlantic/Reykjavik",
  IT: "Europe/Rome",
  JP: "Asia/Tokyo",
  KE: "Africa/Nairobi",
  KR: "Asia/Seoul",
  LT: "Europe/Vilnius",
  LU: "Europe/Luxembourg",
  LV: "Europe/Riga",
  MA: "Africa/Casablanca",
  MD: "Europe/Chisinau",
  MK: "Europe/Skopje",
  MT: "Europe/Malta",
  MX: "America/Mexico_City",
  MY: "Asia/Kuala_Lumpur",
  NG: "Africa/Lagos",
  NL: "Europe/Amsterdam",
  NO: "Europe/Oslo",
  NZ: "Pacific/Auckland",
  PE: "America/Lima",
  PH: "Asia/Manila",
  PL: "Europe/Warsaw",
  PT: "Europe/Lisbon",
  QA: "Asia/Qatar",
  RO: "Europe/Bucharest",
  RS: "Europe/Belgrade",
  RU: "Europe/Moscow",
  SA: "Asia/Riyadh",
  SE: "Europe/Stockholm",
  SG: "Asia/Singapore",
  SI: "Europe/Ljubljana",
  SK: "Europe/Bratislava",
  TH: "Asia/Bangkok",
  TR: "Europe/Istanbul",
  UA: "Europe/Kyiv",
  US: "America/New_York",
  UY: "America/Montevideo",
  VN: "Asia/Ho_Chi_Minh",
  ZA: "Africa/Johannesburg",
};

/**
 * Cities whose zone differs from their country's representative zone. Only
 * the genuinely multi-zone countries need entries — everywhere else the
 * country lookup is already exact.
 */
const CITY_ZONE_OVERRIDES: Record<string, string> = {
  // United States
  Chicago: "America/Chicago",
  Austin: "America/Chicago",
  Denver: "America/Denver",
  "Los Angeles": "America/Los_Angeles",
  "San Francisco": "America/Los_Angeles",
  Seattle: "America/Los_Angeles",
  // Canada
  Vancouver: "America/Vancouver",
  // Australia
  Brisbane: "Australia/Brisbane",
  Melbourne: "Australia/Melbourne",
  // Spain — the Canaries run an hour behind the mainland, but no Canary city
  // is in the list; Málaga/Valencia/Barcelona are all Europe/Madrid.
};

/** Is this a zone the runtime actually knows? */
export function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Work out which zone a role sits in.
 *
 * Precedence is deliberate: an explicit override beats the city, and the city
 * beats the country. A remote role's working hours are a real, separate fact
 * from wherever the company is registered — "remote, must overlap with CET" is
 * a requirement no city lookup could infer — so the override exists to be set
 * by hand.
 *
 * Returns null when nothing resolves, which the UI shows as "no time zone set"
 * rather than guessing.
 */
export function zoneForApplication(app: {
  time_zone?: string | null;
  city?: string | null;
  country?: string | null;
}): string | null {
  const override = app.time_zone?.trim();
  if (override && isValidZone(override)) return override;

  const city = app.city?.trim();
  if (city) {
    const exact = CITY_ZONE_OVERRIDES[city];
    if (exact) return exact;
    const known = CITIES.find((c) => c.city === city);
    if (known && COUNTRY_ZONE[known.code]) return COUNTRY_ZONE[known.code];
  }

  const code = countryCode(app.country);
  return (code && COUNTRY_ZONE[code]) || null;
}

/* ------------------------------------------------------------------ *
 * Offsets
 * ------------------------------------------------------------------ */

/**
 * A zone's UTC offset in minutes at a given instant.
 *
 * Derived by formatting the same instant in the target zone and in UTC and
 * measuring the gap — which is what makes it correct across DST rather than
 * approximately correct for half the year.
 */
export function zoneOffsetMinutes(zone: string, at: Date = new Date()): number | null {
  if (!isValidZone(zone)) return null;
  const format = (tz: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(at);

  const read = (parts: Intl.DateTimeFormatPart[]) => {
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
    // Hour 24 is midnight in some locales' 24-hour formatting.
    const hour = get("hour") % 24;
    return Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  };

  return Math.round((read(format(zone)) - read(format("UTC"))) / 60000);
}

/** Difference between two zones, in minutes, positive when `zone` is ahead. */
export function offsetBetween(zone: string, base: string, at: Date = new Date()): number | null {
  const a = zoneOffsetMinutes(zone, at);
  const b = zoneOffsetMinutes(base, at);
  return a === null || b === null ? null : a - b;
}

/** `+2h`, `−8h`, `+5h30`, or `same time`. Uses a real minus sign. */
export function formatOffset(minutes: number): string {
  if (minutes === 0) return "same time";
  const sign = minutes > 0 ? "+" : "−";
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  return rest === 0 ? `${sign}${hours}h` : `${sign}${hours}h${String(rest).padStart(2, "0")}`;
}

/** The current wall-clock time in a zone, e.g. `14:05`. */
export function timeInZone(zone: string, at: Date = new Date()): string | null {
  if (!isValidZone(zone)) return null;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
}

/* ------------------------------------------------------------------ *
 * Overlap
 * ------------------------------------------------------------------ */

/** A standard working day, as local hours. */
export const WORKDAY = { start: 9, end: 18 } as const;

export type Overlap = {
  /** Hours of shared working time, 0 when the days don't meet. */
  hours: number;
  /** The shared window in *your* local hours, null when there is none. */
  yourStart: number | null;
  yourEnd: number | null;
};

/**
 * How much of a normal working day you actually share.
 *
 * This is the question underneath "+7h" — a raw offset is a number, but
 * whether a call can happen at all is a decision. Computed by shifting their
 * working day into your clock and intersecting.
 */
export function workdayOverlap(offsetMinutes: number): Overlap {
  const shift = offsetMinutes / 60;
  // Their working day expressed in your local hours.
  const theirStart = WORKDAY.start - shift;
  const theirEnd = WORKDAY.end - shift;

  const start = Math.max(WORKDAY.start, theirStart);
  const end = Math.min(WORKDAY.end, theirEnd);
  const hours = Math.max(0, end - start);

  return hours > 0
    ? { hours, yourStart: start, yourEnd: end }
    : { hours: 0, yourStart: null, yourEnd: null };
}

/** `15:00` from an hour like 15.5 → `15:30`. */
export function formatHour(hour: number): string {
  const normalised = ((hour % 24) + 24) % 24;
  const h = Math.floor(normalised);
  const m = Math.round((normalised - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * The one-line summary the detail page shows: how much of the day you share
 * and when, or that you don't.
 */
export function describeOverlap(overlap: Overlap): string {
  if (overlap.hours <= 0) return "No overlap with a 9–18 day — expect async, or odd hours.";
  const rounded = Math.round(overlap.hours * 10) / 10;
  const label = `${rounded}h overlap`;
  return overlap.yourStart !== null && overlap.yourEnd !== null
    ? `${label}, ${formatHour(overlap.yourStart)}–${formatHour(overlap.yourEnd)} your time`
    : label;
}
