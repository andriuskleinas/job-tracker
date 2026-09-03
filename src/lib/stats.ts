import {
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  format,
  startOfWeek,
  subDays,
} from "date-fns";
import { ACTIVE_STATUSES, STATUSES, hasApplied, type Status } from "./status";

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
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

/** Whether an application's date falls within [from, to], inclusive, by local calendar day. */
export function inDateRange(dateIso: string, from: Date, to: Date): boolean {
  const d = startOfDay(parseLocalDate(dateIso));
  return d >= startOfDay(from) && d <= startOfDay(to);
}

/**
 * The period immediately before [from, to], holding its length constant —
 * the last 7 days compares against the 7 before that, a custom 43-day range
 * against the 43 before it. This is what "vs previous period" means anywhere
 * on the analytics page.
 */
export function priorPeriod(from: Date, to: Date): { from: Date; to: Date } {
  const days = differenceInCalendarDays(startOfDay(to), startOfDay(from)) + 1;
  const priorTo = subDays(startOfDay(from), 1);
  const priorFrom = subDays(priorTo, days - 1);
  return { from: priorFrom, to: priorTo };
}

export function statusCounts(apps: StatsApplication[]): Record<Status, number> {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  for (const app of apps) counts[app.status] += 1;
  return counts;
}

/**
 * Rows that represent an application actually sent.
 *
 * Nearly everything below is a rate or a rhythm — applications per period, days
 * since the last one, share that reached interview — and every one of those
 * divides by, or is keyed to, the act of applying. A `wishlist` row records
 * only that a posting looked interesting, and it carries an
 * `application_date` purely because the column is NOT NULL, so letting one
 * through does not just add noise, it adds a *wrong* date to a time series
 * and a wrong denominator to a rate.
 *
 * Filter here rather than in the page, so a new chart cannot forget.
 * `statusCounts` and `statusBreakdown` are the deliberate exceptions: they
 * report on statuses themselves, so they must see all six.
 */
export function appliedOnly<T extends { status: Status }>(rows: T[]): T[] {
  return rows.filter((r) => hasApplied(r.status));
}

/**
 * The two families of number on the analytics page, and why they take
 * different application lists.
 *
 * A snapshot answers "where do things stand right now" — the active
 * pipeline, what's overdue — and a date-range filter has no opinion on that;
 * a role you applied to three months ago and are still interviewing for is
 * exactly as active today whether the page is showing "last 7 days" or
 * "all time". These are computed from every application there is.
 *
 * A period number answers "what happened in the window I selected" —
 * applications sent, offers landed — and is computed only from applications
 * whose `application_date` falls inside that window.
 *
 * Splitting the type in two rather than passing both lists into one function
 * makes that distinction a compile-time fact instead of a comment someone
 * has to keep noticing.
 */
export type SnapshotKpis = {
  activePipeline: number;
  overdueTasks: number;
  openTasks: number;
  daysSinceLastApplication: number | null;
};

export function computeSnapshotKpis(
  apps: StatsApplication[],
  tasks: StatsTask[],
  today: Date = new Date(),
): SnapshotKpis {
  const counts = statusCounts(apps);
  const ages = appliedOnly(apps)
    .map((a) => daysBetween(parseLocalDate(a.application_date), today))
    .filter((d) => d >= 0);

  return {
    activePipeline: ACTIVE_STATUSES.reduce((sum, s) => sum + counts[s], 0),
    overdueTasks: tasks.filter(
      (t) => !t.done && t.due_date !== null && daysBetween(parseLocalDate(t.due_date), today) > 0,
    ).length,
    openTasks: tasks.filter((t) => !t.done).length,
    daysSinceLastApplication: ages.length === 0 ? null : Math.min(...ages),
  };
}

/** How many consecutive days of silence on an active application counts as gone quiet. */
const STALE_DAYS = 30;

export type PeriodKpis = {
  total: number;
  saved: number;
  offers: number;
  stale: number;
};

/**
 * `stale` is deliberately narrower than the "Stalled" pill on an application
 * card: the card also requires zero open tasks, which needs a task join this
 * aggregate doesn't have. This counts applications that are still active and
 * have not moved in {@link STALE_DAYS} days — a real signal on its own, just
 * not a guaranteed match to what any one card is showing, so it earns its
 * own label ("No response") rather than borrowing the card's word for it.
 */
export function computePeriodKpis(
  periodApps: StatsApplication[],
  today: Date = new Date(),
): PeriodKpis {
  const counts = statusCounts(periodApps);
  return {
    total: appliedOnly(periodApps).length,
    saved: counts.wishlist,
    offers: counts.offer,
    stale: periodApps.filter(
      (a) =>
        ACTIVE_STATUSES.includes(a.status) &&
        daysBetween(parseLocalDate(a.application_date), today) >= STALE_DAYS,
    ).length,
  };
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
  let rank = statusFloor(app.status);
  for (const e of events) rank = Math.max(rank, pipelineRank(e.status));
  return rank;
}

/**
 * The rank a status alone vouches for, before the event log is consulted.
 *
 * `rejected` and `withdrawn` rank -1 on the ladder, but an application cannot
 * be rejected without having been sent, so they floor at `applied` — without
 * that, a rejected row with no logged events would drop out of the "Applied"
 * bar and the funnel's top stage would under-count.
 *
 * `wishlist` is the one status that vouches for nothing. It is the only way to
 * say "I have not applied to this", so it must stay below the floor and score
 * -1. A wishlist row whose log *does* contain an `applied` event still climbs
 * to 0 in the loop above — that is someone who applied and then dragged the
 * card back, and the history is the honest record.
 */
function statusFloor(status: Status): number {
  return hasApplied(status) ? Math.max(pipelineRank(status), 0) : -1;
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
  // Anything that never reached `applied` is not in this funnel — it never
  // entered it. That is exactly the wishlist, and dropping it here keeps the
  // top bar at 100% and every share below it a share *of applications sent*.
  const sent = apps.filter((a) => furthestStageRank(a, byApp.get(a.id) ?? []) >= 0);
  const total = sent.length;

  const reachedCounts = PIPELINE.map(
    (_, stageIndex) =>
      sent.filter((a) => furthestStageRank(a, byApp.get(a.id) ?? []) >= stageIndex).length,
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
    // Compare against the same floor. A rejected application whose only logged
    // event is `applied` tells us nothing new — it was applied by definition —
    // so it must not count as history revealing extra reach.
    return withEvents > statusFloor(a.status);
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

function medianOf(spans: number[]): StageDuration | null {
  if (spans.length === 0) return null;
  const sorted = [...spans].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return {
    medianDays:
      sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid],
    sampleSize: sorted.length,
  };
}

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

  return medianOf(spans);
}

/** Any status that counts as the application no longer sitting in silence. */
const RESPONSE_STATUSES: readonly Status[] = ["interviewing", "rejected", "offer"];

/**
 * Median days from applying to the first sign of life — an interview, a
 * rejection, or an offer, whichever the log shows first.
 *
 * "Time to interview" only credits the good outcome, so it stays null for
 * anyone whose applications have so far only ever come back rejected — which
 * is exactly the person most likely to be asking "is this normal?" This
 * answers the question actually being asked more often: how long before I
 * hear *anything*, good or bad.
 */
export function medianDaysToFirstResponse(events: StatsStatusEvent[]): StageDuration | null {
  const byApp = groupEventsByApplication(events);
  const spans: number[] = [];

  for (const list of byApp.values()) {
    const applied = list.find((e) => e.status === "applied");
    if (!applied) continue;
    const response = list.find(
      (e) => RESPONSE_STATUSES.includes(e.status) && e.changed_at > applied.changed_at,
    );
    if (!response) continue;
    const days = daysBetween(new Date(applied.changed_at), new Date(response.changed_at));
    if (days >= 0) spans.push(days);
  }

  return medianOf(spans);
}

/* ------------------------------------------------------------------ *
 * Period-bucketed charts — trend and cohorts
 * ------------------------------------------------------------------ */

export type TrendGranularity = "day" | "week" | "month";

/** Day buckets read cleanly up to about a month, week beyond that, month past about six. */
export function trendGranularityFor(from: Date, to: Date): TrendGranularity {
  const days = differenceInCalendarDays(startOfDay(to), startOfDay(from)) + 1;
  if (days <= 31) return "day";
  if (days <= 183) return "week";
  return "month";
}

/**
 * Cohorts stay coarser than the trend line even over the same range — a
 * daily conversion-rate cohort is mostly one or two applications trying to
 * report a percentage, which is noise wearing the costume of a statistic.
 * Week is the finest grain a conversion rate can carry.
 */
export function cohortGranularityFor(from: Date, to: Date): "week" | "month" {
  const days = differenceInCalendarDays(startOfDay(to), startOfDay(from)) + 1;
  return days <= 60 ? "week" : "month";
}

function bucketStarts(from: Date, to: Date, granularity: TrendGranularity): Date[] {
  if (granularity === "day") return eachDayOfInterval({ start: from, end: to });
  if (granularity === "week")
    return eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 });
  return eachMonthOfInterval({ start: from, end: to });
}

function bucketKey(d: Date, granularity: TrendGranularity): string {
  return granularity === "month" ? format(d, "yyyy-MM") : format(d, "yyyy-MM-dd");
}

/** The year is only worth printing when a bucket's own label could otherwise mean two different dates. */
function bucketLabel(d: Date, granularity: TrendGranularity, spansYears: boolean): string {
  if (granularity === "month") return format(d, spansYears ? "MMM yy" : "MMM");
  return format(d, spansYears ? "MMM d, yy" : "MMM d");
}

function bucketKeyFor(dateIso: string, granularity: TrendGranularity): string {
  const d = parseLocalDate(dateIso);
  if (granularity === "day") return format(d, "yyyy-MM-dd");
  if (granularity === "week") return format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
  return format(d, "yyyy-MM");
}

export type TrendBucket = { key: string; label: string; count: number };

/**
 * Applications sent per bucket across [from, to] at the given granularity.
 * Buckets are pre-seeded at zero across the whole range so a quiet stretch
 * is a real flat line, not a gap the chart silently closes up.
 */
export function applicationTrend(
  apps: StatsApplication[],
  from: Date,
  to: Date,
  granularity: TrendGranularity,
): TrendBucket[] {
  const spansYears = from.getFullYear() !== to.getFullYear();
  const buckets: TrendBucket[] = bucketStarts(startOfDay(from), startOfDay(to), granularity).map(
    (d) => ({
      key: bucketKey(d, granularity),
      label: bucketLabel(d, granularity, spansYears),
      count: 0,
    }),
  );
  const indexByKey = new Map(buckets.map((b, i) => [b.key, i]));

  for (const app of appliedOnly(apps)) {
    const index = indexByKey.get(bucketKeyFor(app.application_date, granularity));
    if (index !== undefined) buckets[index].count += 1;
  }

  return buckets;
}

export type CohortBucket = {
  key: string;
  label: string;
  applied: number;
  reachedInterview: number;
  rate: number | null;
};

/**
 * Applications grouped by the period they were sent, and how many of each
 * cohort ever reached an interview. Cohorting by send-date (not by event
 * date) is what makes the comparison fair: a recent cohort has had less time
 * to convert, which the caller notes rather than hiding. `rate` is null for
 * an empty bucket so it renders as a gap instead of a misleading 0%.
 */
export function conversionCohorts(
  apps: StatsApplication[],
  events: StatsStatusEvent[],
  from: Date,
  to: Date,
  granularity: "week" | "month",
): CohortBucket[] {
  const byApp = groupEventsByApplication(events);
  const interviewRank = pipelineRank("interviewing");
  const spansYears = from.getFullYear() !== to.getFullYear();

  const buckets: CohortBucket[] = bucketStarts(startOfDay(from), startOfDay(to), granularity).map(
    (d) => ({
      key: bucketKey(d, granularity),
      label: bucketLabel(d, granularity, spansYears),
      applied: 0,
      reachedInterview: 0,
      rate: null,
    }),
  );
  const indexByKey = new Map(buckets.map((b, i) => [b.key, i]));

  for (const app of appliedOnly(apps)) {
    const index = indexByKey.get(bucketKeyFor(app.application_date, granularity));
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
