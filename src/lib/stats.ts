import { addDays, format, startOfWeek, subWeeks } from "date-fns";
import { ACTIVE_STATUSES, STATUSES, type Status } from "./status";

/**
 * Structural row shapes — deliberately narrower than the generated Supabase
 * types so these helpers stay pure and easy to test.
 */
export type StatsApplication = { id: string; status: Status; application_date: string };
export type StatsTask = { done: boolean; due_date: string | null };
export type StatsStatusEvent = {
  application_id: string;
  status: Status;
  changed_at: string;
  created_at: string;
};

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
    // Interview rate deliberately lives in `funnelStages`, not here: it needs
    // the event log to count applications that moved past interviewing, and
    // having a second current-status-only version invites the two to disagree.
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
 * The ordered pipeline. `rejected` and `withdrawn` are terminal outcomes that
 * sit off this ladder — they say an application stopped, not how far it got.
 */
export const PIPELINE: readonly Status[] = ["applied", "interviewing", "offer"];

function pipelineRank(status: Status): number {
  return PIPELINE.indexOf(status);
}

/**
 * The furthest pipeline stage an application is known to have reached, using
 * both sources of evidence:
 *
 *  - the status-change log (`application_status_events`), which catches
 *    applications that passed *through* a stage and moved on; and
 *  - the current status, which is itself proof of having reached that stage.
 *
 * Neither alone is sufficient. The log only covers changes recorded since the
 * history table was added, so on its own it under-reports older applications.
 * Current status alone under-reports anything that moved past a stage — an
 * application rejected after interviewing reports only `rejected`. Taking the
 * max of the two is monotonic: reach can only ever be revised upward as more
 * transitions are recorded, so this never regresses what the old
 * current-status-only view reported.
 */
export function furthestStageRank(app: StatsApplication, events: StatsStatusEvent[] = []): number {
  // Floor at `applied`: a terminal status ranks -1 on the ladder, but every
  // application was applied by definition, so that is the true baseline. Without
  // this floor a rejected application with no logged events would drop out of
  // the "Applied" bar entirely, making the funnel's top stage under-count.
  let rank = Math.max(pipelineRank(app.status), 0);
  for (const e of events) rank = Math.max(rank, pipelineRank(e.status));
  return rank;
}

export function groupEventsByApplication(
  events: StatsStatusEvent[],
): Map<string, StatsStatusEvent[]> {
  const byApp = new Map<string, StatsStatusEvent[]>();
  for (const e of events) {
    const list = byApp.get(e.application_id);
    if (list) list.push(e);
    else byApp.set(e.application_id, [e]);
  }
  // Chronological order matters for the duration helpers below.
  for (const list of byApp.values()) {
    list.sort((a, b) => a.changed_at.localeCompare(b.changed_at));
  }
  return byApp;
}

/** Historical stage reach — events unioned with current status. */
export function funnelStages(
  apps: StatsApplication[],
  events: StatsStatusEvent[] = [],
): FunnelStage[] {
  const byApp = groupEventsByApplication(events);
  const total = apps.length;

  const reachedCounts = PIPELINE.map(
    (_, stageIndex) =>
      apps.filter((a) => furthestStageRank(a, byApp.get(a.id) ?? []) >= stageIndex).length,
  );

  return PIPELINE.map((status, i) => ({
    stage: status.charAt(0).toUpperCase() + status.slice(1),
    count: reachedCounts[i],
    share: total === 0 ? 0 : reachedCounts[i] / total,
  }));
}

/**
 * How many applications the log credits with a stage that their current status
 * alone would not reveal. Zero means the historical view is currently telling
 * you nothing the simpler view didn't — worth saying out loud rather than
 * implying the history is richer than it is.
 */
export function eventsBeyondCurrentStatus(
  apps: StatsApplication[],
  events: StatsStatusEvent[],
): number {
  const byApp = groupEventsByApplication(events);
  return apps.filter((a) => {
    const withEvents = furthestStageRank(a, byApp.get(a.id) ?? []);
    // Compare against the same `applied` floor. A rejected application whose
    // only logged event is `applied` tells us nothing new — every application
    // applied — so it must not count as history revealing extra reach.
    return withEvents > Math.max(pipelineRank(a.status), 0);
  }).length;
}

/** When transition recording began — backfilled rows share the migration's timestamp. */
export function historyStartedAt(events: StatsStatusEvent[]): Date | null {
  if (events.length === 0) return null;
  return new Date(
    events.reduce((min, e) => (e.created_at < min ? e.created_at : min), events[0].created_at),
  );
}

export type StageDuration = { medianDays: number; sampleSize: number };

/**
 * Median days from first reaching `from` to first reaching `to`.
 *
 * Requires two *recorded* transitions for the same application, so this stays
 * null until the log has accumulated real movement — it cannot be reconstructed
 * from current status. Returns null rather than a misleading zero.
 */
export function medianDaysBetweenStages(
  events: StatsStatusEvent[],
  from: Status,
  to: Status,
): StageDuration | null {
  const byApp = groupEventsByApplication(events);
  const spans: number[] = [];

  for (const list of byApp.values()) {
    const start = list.find((e) => e.status === from);
    const end = list.find((e) => e.status === to);
    if (!start || !end) continue;
    const days = daysBetween(new Date(start.changed_at), new Date(end.changed_at));
    if (days >= 0) spans.push(days);
  }

  if (spans.length === 0) return null;
  spans.sort((a, b) => a - b);
  const mid = Math.floor(spans.length / 2);
  return {
    medianDays: spans.length % 2 === 0 ? Math.round((spans[mid - 1] + spans[mid]) / 2) : spans[mid],
    sampleSize: spans.length,
  };
}

export type CohortBucket = {
  month: string;
  label: string;
  applied: number;
  reachedInterview: number;
  rate: number | null;
};

/**
 * Applications grouped by the month they were sent, and how many of each month's
 * cohort ever reached an interview.
 *
 * Cohorting by send-month (not by event date) is what makes the comparison fair:
 * a recent month has had less time to convert, which the UI notes rather than
 * hiding. `rate` is null for an empty month so the caller renders a gap instead
 * of a misleading 0%.
 */
export function monthlyCohorts(
  apps: StatsApplication[],
  events: StatsStatusEvent[] = [],
  today: Date = new Date(),
  months = 6,
): CohortBucket[] {
  const byApp = groupEventsByApplication(events);
  const interviewRank = pipelineRank("interviewing");

  const buckets: CohortBucket[] = Array.from({ length: months }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (months - 1 - i), 1);
    return {
      month: format(d, "yyyy-MM"),
      label: format(d, "MMM"),
      applied: 0,
      reachedInterview: 0,
      rate: null,
    };
  });

  const indexByMonth = new Map(buckets.map((b, i) => [b.month, i]));

  for (const app of apps) {
    const key = format(parseLocalDate(app.application_date), "yyyy-MM");
    const index = indexByMonth.get(key);
    if (index === undefined) continue;
    buckets[index].applied += 1;
    if (furthestStageRank(app, byApp.get(app.id) ?? []) >= interviewRank) {
      buckets[index].reachedInterview += 1;
    }
  }

  return buckets.map((b) => ({
    ...b,
    rate: b.applied === 0 ? null : b.reachedInterview / b.applied,
  }));
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
