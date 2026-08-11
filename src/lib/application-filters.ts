import type { ApplicationCardData } from "@/components/ApplicationCard";
import { STATUSES, type Status } from "@/lib/status";
import { JOB_TYPES, type JobType } from "@/lib/job-location";

/**
 * The applications board's filter model. All axes are independent and combine
 * with AND — narrowing on city never widens the status set. Empty in every
 * field means "show everything", which is the default view.
 *
 * `q` is a free-text match on company + position; the rest are exact
 * pick-one(-or-more) filters drawn from the values that actually exist in the
 * user's data, so a filter can never select an option that matches nothing.
 */
export type ApplicationFilters = {
  q: string;
  status: Status[];
  jobType: JobType[];
  company: string;
  country: string;
  city: string;
};

export const EMPTY_FILTERS: ApplicationFilters = {
  q: "",
  status: [],
  jobType: [],
  company: "",
  country: "",
  city: "",
};

/** True when any axis would narrow the list — drives the Clear affordance. */
export function hasActiveFilters(f: ApplicationFilters): boolean {
  return (
    f.q.trim() !== "" ||
    f.status.length > 0 ||
    f.jobType.length > 0 ||
    f.company !== "" ||
    f.country !== "" ||
    f.city !== ""
  );
}

/** How many axes are active — shown as a badge on a collapsed filter control. */
export function activeFilterCount(f: ApplicationFilters): number {
  return (
    (f.q.trim() ? 1 : 0) +
    (f.status.length ? 1 : 0) +
    (f.jobType.length ? 1 : 0) +
    (f.company ? 1 : 0) +
    (f.country ? 1 : 0) +
    (f.city ? 1 : 0)
  );
}

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

/** Apply the filter set to a list. Pure, so it's cheap to memoize and to test. */
export function filterApplications(
  apps: ApplicationCardData[],
  f: ApplicationFilters,
): ApplicationCardData[] {
  const q = norm(f.q);
  const statuses = new Set(f.status);
  const jobTypes = new Set<string>(f.jobType);
  const company = norm(f.company);
  const country = norm(f.country);
  const city = norm(f.city);

  return apps.filter((a) => {
    if (statuses.size && !statuses.has(a.status)) return false;
    if (jobTypes.size && !(a.job_type && jobTypes.has(a.job_type))) return false;
    if (company && norm(a.company) !== company) return false;
    if (country && norm(a.country) !== country) return false;
    if (city && norm(a.city) !== city) return false;
    if (q && !`${norm(a.company)} ${norm(a.position)}`.includes(q)) return false;
    return true;
  });
}

/**
 * The distinct companies present in the data, sorted. Like country/city this
 * is drawn from real rows, so picking a company always returns something.
 */
export function availableCompanies(apps: ApplicationCardData[]): string[] {
  const seen = new Map<string, string>();
  for (const a of apps) {
    const name = a.company?.trim();
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * The distinct countries present in the data, sorted, so the country picker
 * only ever offers a value that will return at least one row. Comparison is
 * case-insensitive but the first-seen spelling is what's shown.
 */
export function availableCountries(apps: ApplicationCardData[]): string[] {
  const seen = new Map<string, string>();
  for (const a of apps) {
    const name = a.country?.trim();
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * Distinct cities present in the data. When a country is selected the list is
 * scoped to that country, so City and Country stay coherent rather than
 * offering cities that would contradict the chosen country.
 */
export function availableCities(
  apps: ApplicationCardData[],
  country: string,
): { city: string; country: string }[] {
  const wanted = norm(country);
  const seen = new Map<string, { city: string; country: string }>();
  for (const a of apps) {
    const city = a.city?.trim();
    if (!city) continue;
    if (wanted && norm(a.country) !== wanted) continue;
    if (!seen.has(city.toLowerCase())) {
      seen.set(city.toLowerCase(), { city, country: a.country?.trim() ?? "" });
    }
  }
  return [...seen.values()].sort((a, b) => a.city.localeCompare(b.city));
}

/** The job types present in the data, in canonical order (remote→hybrid→onsite),
 * so the control only offers a type that will return at least one row. */
export function availableJobTypes(apps: ApplicationCardData[]): JobType[] {
  const present = new Set(apps.map((a) => a.job_type).filter(Boolean));
  return JOB_TYPES.filter((t) => present.has(t));
}

/** Reusable ordering for status controls — pipeline order, not alphabetical. */
export const STATUS_ORDER = STATUSES;

/** Reusable ordering for job-type controls. */
export const JOB_TYPE_ORDER = JOB_TYPES;
