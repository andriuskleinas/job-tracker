import { addDays, format, startOfWeek, subWeeks } from "date-fns";
import { ACTIVE_STATUSES, STATUSES, type Status } from "./status";

/**
 * Structural row shapes — deliberately narrower than the generated Supabase
 * types so these helpers stay pure and easy to test.
 */
export type StatsApplication = { status: Status; application_date: string };
export type StatsTask = { done: boolean; due_date: string | null };

/**
 * Parse a Postgres DATE (`YYYY-MM-DD`) as a *local* calendar date.
 *
 * `new Date("2026-07-01")` is parsed as UTC midnight, which lands on Jun 30 for
 * anyone west of Greenwich — enough to shift an application into the wrong week
 * bucket. Splitting the parts avoids that.
 */
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Midnight local time, so day comparisons ignore the clock. */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

export function statusCounts(apps: StatsApplication[]): Record<Status, number> {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  for (const app of apps) counts[app.status] += 1;
  return counts;
}

export type Kpis = {
  total: number;
  active: number;
  interviewRate: number | null;
  offers: number;
  lastSeven: number;
  lastSevenDelta: number;
  overdueTasks: number;
  openTasks: number;
  daysSinceLastApplication: number | null;
};

export function computeKpis(
  apps: StatsApplication[],
  tasks: StatsTask[],
  today: Date = new Date(),
): Kpis {
  const counts = statusCounts(apps);
  const total = apps.length;

  const inWindow = (app: StatsApplication, fromDaysAgo: number, toDaysAgo: number) => {
    const age = daysBetween(parseLocalDate(app.application_date), today);
    return age >= toDaysAgo && age <= fromDaysAgo;
  };

  const lastSeven = apps.filter((a) => inWindow(a, 6, 0)).length;
  const priorSeven = apps.filter((a) => inWindow(a, 13, 7)).length;

  const ages = apps.map((a) => daysBetween(parseLocalDate(a.application_date), today));
  const futureSafeAges = ages.filter((d) => d >= 0);

  return {
    total,
    active: ACTIVE_STATUSES.reduce((sum, s) => sum + counts[s], 0),
    // Current-status only: an application rejected *after* an interview is
    // recorded as `rejected`, so this is a lower bound. See the chart caption.
    interviewRate: total === 0 ? null : (counts.interviewing + counts.offer) / total,
    offers: counts.offer,
    lastSeven,
    lastSevenDelta: lastSeven - priorSeven,
    overdueTasks: tasks.filter(
      (t) => !t.done && t.due_date !== null && daysBetween(parseLocalDate(t.due_date), today) > 0,
    ).length,
    openTasks: tasks.filter((t) => !t.done).length,
    daysSinceLastApplication: futureSafeAges.length === 0 ? null : Math.min(...futureSafeAges),
  };
}

export type WeekBucket = { weekStart: string; label: string; count: number };

/** Applications per ISO week (Monday-start) for the trailing `weeks` weeks. */
export function weeklyApplications(
  apps: StatsApplication[],
  today: Date = new Date(),
  weeks = 12,
): WeekBucket[] {
  const firstWeek = startOfWeek(subWeeks(today, weeks - 1), { weekStartsOn: 1 });

  const buckets: WeekBucket[] = Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDays(firstWeek, i * 7);
    return {
      weekStart: format(weekStart, "yyyy-MM-dd"),
      label: format(weekStart, "MMM d"),
      count: 0,
    };
  });

  const indexByWeek = new Map(buckets.map((b, i) => [b.weekStart, i]));

  for (const app of apps) {
    const key = format(
      startOfWeek(parseLocalDate(app.application_date), { weekStartsOn: 1 }),
      "yyyy-MM-dd",
    );
    const index = indexByWeek.get(key);
    if (index !== undefined) buckets[index].count += 1;
  }

  return buckets;
}

export type FunnelStage = { stage: string; count: number; share: number };

/**
 * Stage reach based on *current* status.
 *
 * `applications.status` is a single mutable column with no history, so an
 * application that interviewed and was then rejected only ever reports
 * `rejected`. Every count here is therefore a lower bound, which the UI states
 * plainly rather than implying a true historical funnel.
 */
export function funnelStages(apps: StatsApplication[]): FunnelStage[] {
  const counts = statusCounts(apps);
  const total = apps.length;
  const reached = [
    { stage: "Applied", count: total },
    { stage: "Interviewing", count: counts.interviewing + counts.offer },
    { stage: "Offer", count: counts.offer },
  ];
  return reached.map((s) => ({ ...s, share: total === 0 ? 0 : s.count / total }));
}

export type StatusDatum = { status: Status; label: string; count: number };

export function statusBreakdown(apps: StatsApplication[]): StatusDatum[] {
  const counts = statusCounts(apps);
  return STATUSES.map((status) => ({
    status,
    label: status.charAt(0).toUpperCase() + status.slice(1),
    count: counts[status],
  }));
}
