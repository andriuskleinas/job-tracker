import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { addDays, subDays } from "date-fns";
import { z } from "zod";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import {
  AnalyticsRangeFilter,
  RANGE_PRESETS,
  type RangePreset,
} from "@/components/AnalyticsRangeFilter";
import {
  TaskWindowFilter,
  TASK_WINDOW_PRESETS,
  type TaskWindowPreset,
} from "@/components/TaskWindowFilter";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { STATUSES, statusColor, statusFill, type Status } from "@/lib/status";
import {
  appliedOnly,
  applicationTrend,
  cohortGranularityFor,
  computePeriodKpis,
  computeSnapshotKpis,
  conversionCohorts,
  eventsBeyondCurrentStatus,
  funnelStages,
  historyStartedAt,
  inDateRange,
  medianDaysBetweenStages,
  medianDaysToFirstResponse,
  parseLocalDate,
  priorPeriod,
  startOfDay,
  statusBreakdown,
  trendGranularityFor,
  PIPELINE,
  type StatsApplication,
  type StatsStatusEvent,
  type StatsTask,
} from "@/lib/stats";
import { ArrowDown, ArrowUp, Plus, TriangleAlert } from "lucide-react";

/*
 * The date-range filter lives in the URL, same reasoning as the
 * applications page's filters: a filtered analytics page is shareable,
 * survives a refresh, and works with the back button. `range=custom`
 * without both `from`/`to` present falls back to "all" — a half-specified
 * custom range is not a range.
 *
 * `taskWindow`/`taskDue` are a second, independent pair for the "Next N
 * days" panel — forward-looking, so it needs its own state rather than
 * reusing `range`/`from`/`to`, which describe a backward-looking window.
 */
const searchSchema = z.object({
  range: z.enum(RANGE_PRESETS).catch("all").optional(),
  from: z.string().catch("").optional(),
  to: z.string().catch("").optional(),
  taskWindow: z.enum(TASK_WINDOW_PRESETS).catch("14d").optional(),
  taskDue: z.string().catch("").optional(),
});

type AnalyticsSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Job Tracker" },
      {
        name: "description",
        content: "Where every application stands, and what's moving you closer to an offer.",
      },
      { property: "og:title", content: "Analytics — Job Tracker" },
      {
        property: "og:description",
        content: "Where every application stands, and what's moving you closer to an offer.",
      },
    ],
  }),
  validateSearch: (search): AnalyticsSearch => searchSchema.parse(search),
  component: AnalyticsPage,
});

type LinkedRole = { id: string; company: string; position: string };

/**
 * A task carries every role it was assigned to, not one. The shape — and the
 * select that produces it — has to stay identical to the tasks page, because
 * both read the same `["tasks", "all"]` cache entry and whichever mounts
 * first is the one that fills it.
 */
type TaskWithApp = StatsTask & {
  id: string;
  title: string;
  task_applications: { application: LinkedRole | null }[];
};

const linkedRoles = (t: TaskWithApp): LinkedRole[] =>
  (t.task_applications ?? []).map((ta) => ta.application).filter((a): a is LinkedRole => !!a);

/*
 * Colour on this page is the status language from `@/lib/status`, nothing
 * else. A bar and a badge that share a hue always share a meaning, so the
 * page needs no legend of its own to be read — the one under the heading is
 * a key to the whole vocabulary, not an index of these particular charts.
 *
 * Where a chart counts applications generally rather than by outcome
 * (trend, cohort size) it takes `applied` ink: those are applications you
 * sent, which is what ink means everywhere else here.
 *
 * Ink as the default mark is also what lets gold and green mean something on
 * this page. The trend line and the cohort totals are the two biggest shapes
 * here, and drawing them in a hue would have made every chart equally loud;
 * in black they are the ground, and the only colour on screen lands on the
 * two things worth looking up for — an interview in flight (gold) and an
 * offer (green).
 */
const barConfig = {
  count: { label: "Applications", color: "var(--status-applied)" },
} satisfies ChartConfig;

const stageConfig = {
  count: { label: "Applications", color: "var(--status-applied)" },
} satisfies ChartConfig;

const cohortConfig = {
  applied: { label: "Applied", color: "var(--status-applied)" },
  reachedInterview: { label: "Reached interview", color: "var(--status-interviewing)" },
} satisfies ChartConfig;

/**
 * Enter animation, split by mark type — <Area> from recharts, <Bar> from CSS.
 *
 * The 2.15.4 note this replaces said react-smooth's enter animation never
 * advanced under React 19, leaving bars unrendered. recharts 3.10.1 declares
 * React 19 support, so that should be fixed; <Area> is animated here on that
 * basis and draws correctly.
 *
 * The bars still opt out with `isAnimationActive={false}` and grow via CSS
 * instead (`chart-bars-h` / `chart-bars-v` in styles.css). That is not a claim
 * that 3.x bars are broken — it is that the two failure modes are not
 * symmetric. A bar that opts out is drawn at full geometry by recharts and
 * merely scaled by a stylesheet, so the worst case is a chart that appears
 * without motion. A bar that relies on react-smooth and does not get a
 * ticking clock renders no path at all, which is the failure the old comment
 * describes. The cheap side of that trade is the one worth taking on a screen
 * whose whole job is showing numbers.
 *
 * The line runs a beat longer than the bars so the eye lands on the
 * distribution before the trend. `prefers-reduced-motion` zeroes the duration
 * here and suppresses the keyframes in CSS — recharts has no notion of the
 * setting, so both halves have to carry it themselves.
 */
const ENTER_MS = 480;

function AnalyticsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  // Same query keys as the applications and tasks pages, so navigating
  // between them reuses one cache entry instead of refetching.
  const { data: apps = [], isLoading: appsLoading } = useQuery({
    queryKey: ["applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("*")
        .order("application_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, task_applications(application:applications(id, company, position))")
        .order("done")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["status-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("application_status_events")
        .select("application_id, status, changed_at, created_at")
        .order("changed_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  if (appsLoading || tasksLoading || eventsLoading) return <AnalyticsSkeleton />;

  // resetScroll: false — this fires from filters anywhere on the page, including
  // the task panel's own filter at the bottom, and neither should jump the
  // page back to the top.
  const setRange = (patch: Partial<AnalyticsSearch>) =>
    navigate({ search: { ...search, ...patch }, replace: true, resetScroll: false });

  return (
    <AnalyticsView
      apps={apps as StatsApplication[]}
      tasks={tasks as unknown as TaskWithApp[]}
      events={events as StatsStatusEvent[]}
      range={search.range ?? "all"}
      customFrom={search.from ? parseLocalDate(search.from) : null}
      customTo={search.to ? parseLocalDate(search.to) : null}
      onPresetChange={(range) => setRange({ range, from: undefined, to: undefined })}
      onCustomChange={(from, to) => setRange({ range: "custom", from: toIso(from), to: toIso(to) })}
      taskWindow={search.taskWindow ?? "14d"}
      taskDue={search.taskDue ? parseLocalDate(search.taskDue) : null}
      onTaskWindowChange={(taskWindow) => setRange({ taskWindow, taskDue: undefined })}
      onTaskDueChange={(due) => setRange({ taskWindow: "custom", taskDue: toIso(due) })}
    />
  );
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Presentation only — kept separate from fetching so it can be rendered with fixtures. */
export function AnalyticsView({
  apps,
  tasks,
  events = [],
  range = "all",
  customFrom = null,
  customTo = null,
  onPresetChange,
  onCustomChange,
  taskWindow = "14d",
  taskDue = null,
  onTaskWindowChange,
  onTaskDueChange,
}: {
  apps: StatsApplication[];
  tasks: TaskWithApp[];
  events?: StatsStatusEvent[];
  range?: RangePreset;
  customFrom?: Date | null;
  customTo?: Date | null;
  onPresetChange?: (range: Exclude<RangePreset, "custom">) => void;
  onCustomChange?: (from: Date, to: Date) => void;
  taskWindow?: TaskWindowPreset;
  taskDue?: Date | null;
  onTaskWindowChange?: (window: Exclude<TaskWindowPreset, "custom">) => void;
  onTaskDueChange?: (due: Date) => void;
}) {
  const statApps = apps;
  const statTasks = tasks;

  /*
   * The horizontal charts reserve fixed pixels for the category axis and the
   * value labels. At the full width that is comfortable; on a phone it leaves
   * the bars almost no room, so both allowances shrink and the stage labels
   * drop their percentage suffix.
   */
  const isMobile = useIsMobile();
  const reducedMotion = useReducedMotion();
  const trendMs = reducedMotion ? 0 : ENTER_MS + 160;
  // 86px is the measured width of the longest tick ("Interviewing") at 11px —
  // anything narrower clips its first character rather than wrapping.
  const axisWidth = isMobile ? 86 : 92;
  const axisTick = isMobile ? { fontSize: 11 } : undefined;
  const labelGutter = isMobile ? 30 : 96;

  const today = useMemo(() => startOfDay(new Date()), []);

  // "All time" needs an actual earliest date to anchor its buckets — without
  // one, a brand-new account with one application yesterday would seed empty
  // day/week/month buckets back to some arbitrary hardcoded horizon.
  const earliestAppDate = useMemo(() => {
    if (statApps.length === 0) return today;
    const times = statApps.map((a) => startOfDay(parseLocalDate(a.application_date)).getTime());
    return new Date(Math.min(...times));
  }, [statApps, today]);

  const { from, to } = useMemo(() => {
    if (range === "custom" && customFrom && customTo) return { from: customFrom, to: customTo };
    if (range === "7d") return { from: subDays(today, 6), to: today };
    if (range === "14d") return { from: subDays(today, 13), to: today };
    if (range === "30d") return { from: subDays(today, 29), to: today };
    return { from: earliestAppDate, to: today };
  }, [range, customFrom, customTo, today, earliestAppDate]);

  const periodApps = useMemo(
    () => statApps.filter((a) => inDateRange(a.application_date, from, to)),
    [statApps, from, to],
  );
  const periodEvents = useMemo(() => {
    const ids = new Set(periodApps.map((a) => a.id));
    return events.filter((e) => ids.has(e.application_id));
  }, [events, periodApps]);

  // Comparing the selected period against the one immediately before it, of
  // the same length — meaningless for "all time", which has nothing before
  // it to compare against.
  const showComparison = range !== "all";
  const priorTotal = useMemo(() => {
    if (!showComparison) return 0;
    const prior = priorPeriod(from, to);
    return appliedOnly(
      statApps.filter((a) => inDateRange(a.application_date, prior.from, prior.to)),
    ).length;
  }, [showComparison, statApps, from, to]);

  const snapshot = useMemo(
    () => computeSnapshotKpis(statApps, statTasks, today),
    [statApps, statTasks, today],
  );
  const period = useMemo(() => computePeriodKpis(periodApps, today), [periodApps, today]);

  const breakdown = useMemo(() => statusBreakdown(periodApps), [periodApps]);
  const funnel = useMemo(() => funnelStages(periodApps, periodEvents), [periodApps, periodEvents]);
  /*
   * The funnel's own population, and the only correct denominator for its
   * percentages.
   *
   * It is not `period.total`. That counts rows whose *current* status is not
   * `wishlist`; this counts rows the history says ever reached `applied`, and
   * a role that was applied to and later dragged back to the wishlist is in
   * the second set but not the first. Dividing one by the other printed
   * "46 (112%)" on the fixture data — a share above 100% is the funnel
   * reporting more applications than it says exist.
   */
  const funnelTotal = funnel[0]?.count ?? 0;

  const trendGranularity = useMemo(() => trendGranularityFor(from, to), [from, to]);
  const trend = useMemo(
    () => applicationTrend(periodApps, from, to, trendGranularity),
    [periodApps, from, to, trendGranularity],
  );

  const cohortGranularity = useMemo(() => cohortGranularityFor(from, to), [from, to]);
  const cohorts = useMemo(
    () => conversionCohorts(periodApps, periodEvents, from, to, cohortGranularity),
    [periodApps, periodEvents, from, to, cohortGranularity],
  );

  const daysToFirstResponse = useMemo(
    () => medianDaysToFirstResponse(periodEvents),
    [periodEvents],
  );
  const daysToInterview = useMemo(
    () => medianDaysBetweenStages(periodEvents, "applied", "interviewing"),
    [periodEvents],
  );
  const daysToOffer = useMemo(
    () => medianDaysBetweenStages(periodEvents, "applied", "offer"),
    [periodEvents],
  );

  const historyDepth = useMemo(
    () => eventsBeyondCurrentStatus(periodApps, periodEvents),
    [periodApps, periodEvents],
  );
  const historySince = useMemo(() => historyStartedAt(periodEvents), [periodEvents]);

  // Forward-looking, so it takes its own horizon rather than the page's
  // backward-looking `from`/`to` — see TaskWindowFilter.
  const taskHorizon = useMemo(() => {
    if (taskWindow === "custom" && taskDue) return taskDue;
    if (taskWindow === "7d") return addDays(today, 7);
    if (taskWindow === "30d") return addDays(today, 30);
    return addDays(today, 14);
  }, [taskWindow, taskDue, today]);

  const dueSoon = useMemo(
    () =>
      statTasks
        .filter((t) => !t.done && t.due_date !== null)
        .filter((t) => parseLocalDate(t.due_date as string) <= taskHorizon),
    [statTasks, taskHorizon],
  );
  const upcoming = dueSoon.slice(0, 8);
  const upcomingHidden = dueSoon.length - upcoming.length;

  const periodLabel = rangeLabel(range, from, to);
  const priorLabel = priorRangeLabel(range, from, to);

  if (apps.length === 0) {
    return (
      <main className="container-page page-body">
        <PageHeading />
        <EmptyState
          title="No applications yet"
          body="Your numbers appear here as soon as you log the first role you're going after."
          action={
            <Button asChild>
              <Link to="/applications">
                <Plus className="h-4 w-4" /> Add an application
              </Link>
            </Button>
          }
        />
      </main>
    );
  }

  return (
    <main className="container-page page-body">
      <PageHeading
        actions={
          onPresetChange &&
          onCustomChange && (
            <AnalyticsRangeFilter
              preset={range}
              customFrom={customFrom ?? null}
              customTo={customTo ?? null}
              onPresetChange={onPresetChange}
              onCustomChange={onCustomChange}
            />
          )
        }
      />
      <StatusLegend />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Key metrics">
        {/* Saved roles are counted, never added in: every rate on this page
            divides by applications sent, so a wishlist row must not inflate
            the headline it is measured against. It rides along as a hint so
            the number is still visible somewhere. */}
        <StatTile
          label="Applications"
          value={period.total}
          delta={showComparison ? period.total - priorTotal : undefined}
          hint={
            period.saved > 0
              ? `${period.saved} more saved, not applied${showComparison ? ` · vs ${priorLabel}` : ""}`
              : showComparison
                ? `vs ${priorLabel}`
                : periodLabel
          }
        />
        <StatTile
          label="Active pipeline"
          value={snapshot.activePipeline}
          hint="Applied or interviewing, right now"
          accent="applied"
        />
        {/* Reads from the same funnel as the Stage reach chart, so the two can
            never disagree on screen. */}
        <StatTile
          label="Interview rate"
          value={funnelTotal === 0 ? "—" : `${Math.round((funnel[1]?.share ?? 0) * 100)}%`}
          hint={
            historyDepth > 0
              ? `Ever reached interview · ${periodLabel}`
              : `Ever reached interview (lower bound) · ${periodLabel}`
          }
          accent="interviewing"
        />
        <StatTile label="Offers" value={period.offers} hint={periodLabel} accent="offer" />
        {/* New: the applications that are still technically alive but have
            gone quiet. Distinct from Overdue tasks below — this fires with no
            task involved at all, which is exactly the case a task list can't
            catch. */}
        <StatTile
          label="No response in 30+ days"
          value={period.stale}
          alert={period.stale > 0}
          hint={`Applied or interviewing, no movement · ${periodLabel}`}
        />
        <StatTile
          label="Overdue tasks"
          value={snapshot.overdueTasks}
          alert={snapshot.overdueTasks > 0}
          hint={`${snapshot.openTasks} open in total`}
        />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Applications by status</CardTitle>
            {/* "roles", not "applications": this chart is the one place that
                counts wishlist rows, so the applications-only total would not
                add up to the bars beneath it. */}
            <CardDescription>
              Where {range === "all" ? "all " : ""}
              {periodApps.length} role{periodApps.length === 1 ? "" : "s"}
              {range === "all" ? "" : ` from ${periodLabel}`} stand right now.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={barConfig}
              className="chart-bars-h aspect-auto h-[220px] w-full"
            >
              <BarChart
                accessibilityLayer
                data={breakdown}
                layout="vertical"
                margin={{ left: 4, right: 28, top: 4, bottom: 4 }}
              >
                <CartesianGrid horizontal={false} />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  width={axisWidth}
                  tick={axisTick}
                  tickMargin={6}
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Bar
                  dataKey="count"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={24}
                  isAnimationActive={false}
                >
                  {breakdown.map((b) => (
                    <Cell key={b.status} fill={statusFill[b.status as Status]} />
                  ))}
                  <LabelList
                    dataKey="count"
                    position="right"
                    offset={8}
                    className="fill-foreground"
                    fontSize={12}
                  />
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stage reach</CardTitle>
            <CardDescription>
              {historyDepth > 0 ? (
                <>
                  How far each application from {periodLabel} got, including {historyDepth} that
                  moved past a stage before reaching {historyDepth === 1 ? "its" : "their"} current
                  status.
                </>
              ) : (
                <>
                  Still current-status only — no recorded transition yet credits an application with
                  a stage its status doesn&apos;t already show, so these remain lower bounds.
                  {historySince &&
                    ` Transitions recorded since ${historySince.toLocaleDateString()}.`}
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={stageConfig}
              className="chart-bars-h aspect-auto h-[220px] w-full"
            >
              <BarChart
                accessibilityLayer
                data={funnel}
                layout="vertical"
                margin={{ left: 4, right: labelGutter, top: 4, bottom: 4 }}
              >
                <CartesianGrid horizontal={false} />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="stage"
                  tickLine={false}
                  axisLine={false}
                  width={axisWidth}
                  tick={axisTick}
                  tickMargin={6}
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Bar
                  dataKey="count"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={24}
                  isAnimationActive={false}
                >
                  {funnel.map((stage, i) => (
                    <Cell key={stage.stage} fill={statusFill[PIPELINE[i]]} />
                  ))}
                  <LabelList
                    dataKey="count"
                    position="right"
                    offset={8}
                    className="fill-foreground"
                    fontSize={12}
                    // Without an explicit width recharts inherits the bar's own
                    // width, and a short bar wraps its label onto two lines.
                    width={isMobile ? 28 : 88}
                    // recharts 3 types this as RenderableText (string | number
                    // | boolean | null | undefined), so the share is computed
                    // only once the value is known to be a real number.
                    formatter={(value: string | number | boolean | null | undefined) => {
                      if (typeof value !== "number" || funnelTotal === 0 || isMobile) {
                        return `${value ?? ""}`;
                      }
                      return `${value} (${Math.round((value / funnelTotal) * 100)}%)`;
                    }}
                  />
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </section>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">
            Applications{" "}
            {trendGranularity === "day"
              ? "per day"
              : trendGranularity === "week"
                ? "per week"
                : "per month"}
          </CardTitle>
          <CardDescription>{sentenceCase(periodLabel)}, by the date you applied.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* A line, not columns: this panel is about the shape of the
              selected period — where the search sped up and where it
              stalled — and a trend is what a line is for. Zero buckets are
              real zeros, so the line touches the baseline rather than
              breaking. */}
          <ChartContainer config={barConfig} className="aspect-auto h-[240px] w-full">
            <AreaChart
              accessibilityLayer
              data={trend}
              margin={{ left: 4, right: 4, top: 8, bottom: 4 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval="preserveStartEnd"
                minTickGap={16}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={28}
                allowDecimals={false}
                tickMargin={4}
              />
              <ChartTooltip
                cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                content={<ChartTooltipContent labelKey="label" />}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--color-count)"
                strokeWidth={2}
                // A wash, not a block — it gives the line a body to read
                // against without competing with the bars on this page.
                fill="var(--color-count)"
                fillOpacity={0.12}
                // Dots ring themselves in the card colour so they stay
                // legible where the line runs through them.
                dot={{ r: 3.5, strokeWidth: 2, stroke: "var(--card)" }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
                animationDuration={trendMs}
              />
            </AreaChart>
          </ChartContainer>
          <DataTable
            caption="Applications over time"
            columns={["Period", "Applications"]}
            rows={trend.map((w) => [w.label, String(w.count)])}
          />
        </CardContent>
      </Card>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Interview conversion by cohort</CardTitle>
            <CardDescription>
              Applications from {periodLabel} grouped by the{" "}
              {cohortGranularity === "week" ? "week" : "month"} you sent them, and how many ever
              reached an interview. Recent cohorts have had less time to convert.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={cohortConfig}
              className="chart-bars-v aspect-auto h-[220px] w-full"
            >
              <BarChart
                accessibilityLayer
                data={cohorts}
                margin={{ left: 4, right: 4, top: 8, bottom: 4 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={28}
                  allowDecimals={false}
                  tickMargin={4}
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent labelKey="label" />} />
                <ChartLegend content={<ChartLegendContent />} />
                {/* Nested magnitudes: interviews are a subset of applications, so
                    they share one hue at two steps rather than two identities. */}
                <Bar
                  dataKey="applied"
                  fill="var(--color-applied)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                  isAnimationActive={false}
                />
                {/* The subset lands after the total it sits inside, so the
                    nesting is legible as the pair draws. */}
                <Bar
                  dataKey="reachedInterview"
                  fill="var(--color-reachedInterview)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                  isAnimationActive={false}
                />
              </BarChart>
            </ChartContainer>
            <DataTable
              caption="Interview conversion by cohort"
              columns={["Period", "Applied", "Reached interview", "Rate"]}
              rows={cohorts.map((c) => [
                c.label,
                String(c.applied),
                String(c.reachedInterview),
                c.rate === null ? "—" : `${Math.round(c.rate * 100)}%`,
              ])}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Response times</CardTitle>
            <CardDescription>Median days from applying, {periodLabel}.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ResponseTimeStat
              label="First response"
              hint="Interview, rejection, or offer — whichever came first"
              duration={daysToFirstResponse}
              historySince={historySince}
            />
            <ResponseTimeStat
              label="Interview"
              duration={daysToInterview}
              historySince={historySince}
            />
            <ResponseTimeStat label="Offer" duration={daysToOffer} historySince={historySince} />
          </CardContent>
        </Card>
      </section>

      <Card className="mt-4">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">{taskWindowTitle(taskWindow, taskHorizon)}</CardTitle>
            <CardDescription>Open tasks coming due, soonest first.</CardDescription>
          </div>
          {onTaskWindowChange && onTaskDueChange && (
            <TaskWindowFilter
              preset={taskWindow}
              customDue={taskDue}
              onPresetChange={onTaskWindowChange}
              onCustomChange={onTaskDueChange}
            />
          )}
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing due {taskWindowPhrase(taskWindow, taskHorizon)}.{" "}
              <Link to="/tasks" className="underline underline-offset-4">
                View all tasks
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y">
              {upcoming.map((t) => {
                const due = parseLocalDate(t.due_date as string);
                const overdue = due < new Date(new Date().toDateString());
                const roles = linkedRoles(t);
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{t.title}</p>
                      {/* One task can cover several roles; this row has space
                          for one, so the rest are counted rather than listed. */}
                      {roles.length > 0 && (
                        <p className="truncate text-xs text-muted-foreground">
                          <Link
                            to="/applications/$id"
                            params={{ id: roles[0].id }}
                            className="hover:underline"
                          >
                            {roles[0].position} · {roles[0].company}
                          </Link>
                          {roles.length > 1 && ` +${roles.length - 1} more`}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 text-xs ${overdue ? "font-medium text-brand-accent" : "text-muted-foreground"}`}
                    >
                      {overdue && <TriangleAlert className="mr-1 inline h-3 w-3" aria-hidden />}
                      {overdue ? "Overdue " : "Due "}
                      {due.toLocaleDateString()}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {upcomingHidden > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              +{upcomingHidden} more due in this window.{" "}
              <Link to="/tasks" className="underline underline-offset-4">
                View all tasks
              </Link>
              .
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

/**
 * A short, lowercase phrase describing the selected window — "the last 30
 * days", "all time", "Jan 5 – Feb 2, 2026" — reused in every hint and
 * description on the page so the page never has to explain the filter twice
 * in two different words.
 */
function rangeLabel(range: RangePreset, from: Date, to: Date): string {
  if (range === "7d") return "the last 7 days";
  if (range === "14d") return "the last 14 days";
  if (range === "30d") return "the last 30 days";
  if (range === "custom") {
    const spansYears = from.getFullYear() !== to.getFullYear();
    const fmt = (d: Date) =>
      d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: spansYears ? "numeric" : undefined,
      });
    return `${fmt(from)} – ${fmt(to)}`;
  }
  return "all time";
}

function priorRangeLabel(range: RangePreset, from: Date, to: Date): string {
  if (range === "7d") return "the previous 7 days";
  if (range === "14d") return "the previous 14 days";
  if (range === "30d") return "the previous 30 days";
  const prior = priorPeriod(from, to);
  return rangeLabel("custom", prior.from, prior.to);
}

function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The card title for the task panel — "Next 7 days" through a custom "Due by Mar 5". */
function taskWindowTitle(preset: TaskWindowPreset, horizon: Date): string {
  if (preset === "custom") return `Due by ${horizon.toLocaleDateString()}`;
  if (preset === "7d") return "Next 7 days";
  if (preset === "30d") return "Next 30 days";
  return "Next 14 days";
}

/** The empty-state phrase — "Nothing due {this}." */
function taskWindowPhrase(preset: TaskWindowPreset, horizon: Date): string {
  if (preset === "custom") return `by ${horizon.toLocaleDateString()}`;
  if (preset === "7d") return "in the next week";
  if (preset === "30d") return "in the next month";
  return "in the next two weeks";
}

/**
 * The key to the colour language, and it belongs above the charts it explains
 * — at the foot it sat below the fold, which is the one place a legend is no
 * use. It lists all six statuses rather than only the ones currently in the
 * data, so the vocabulary reads the same on an empty account as a full one.
 */
function StatusLegend() {
  return (
    // Badge renders a <div>, so this wrapper must not be a <p>.
    <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground sm:mb-6">
      <span className="mr-0.5">Status legend:</span>
      {STATUSES.map((s) => (
        <Badge key={s} variant="outline" className={`${statusColor[s]} capitalize`}>
          {s}
        </Badge>
      ))}
    </div>
  );
}

function PageHeading({ actions }: { actions?: ReactNode }) {
  return (
    <PageHeader
      title="Analytics"
      description="Where your search stands, and what's moving it forward."
      actions={actions}
    />
  );
}

/**
 * `accent` ties a tile to the status it counts, and `alert` marks the one tile
 * that is a warning rather than an identity.
 *
 * Either way the hue rides the tile's top edge, never the figure: a number is
 * text, and text stays in text ink so it keeps its full contrast. The rule
 * replaces a 2px dot that sat beside the label. The dot was correct and
 * unreadable — at that size gold on white is a smudge, which meant the three
 * tiles that carry the page's only colour were the three you couldn't see it
 * on. A 3px edge is the same claim at a size that survives the trip to the
 * screen, and it costs the tile no contrast anywhere.
 */
function StatTile({
  label,
  value,
  hint,
  delta,
  alert,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  delta?: number;
  alert?: boolean;
  accent?: Status;
}) {
  // Overdue work is the one warning on this page, and it wears the same red the
  // overdue chips on the cards and tasks list wear.
  const edge = alert ? "var(--status-rejected)" : accent ? statusFill[accent] : null;

  return (
    <Card className="relative overflow-hidden">
      {edge && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{ background: edge }}
        />
      )}
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="mt-1 flex items-baseline gap-2">
          {/* Proportional figures: tabular-nums makes a display-size number look loose. */}
          <span
            className={`text-3xl font-semibold tracking-[-0.02em] ${alert ? "text-brand-accent" : ""}`}
          >
            {value}
          </span>
          {delta !== undefined && delta !== 0 && (
            <span
              className={`flex items-center text-xs ${
                delta > 0 ? "text-[var(--status-offer-text)]" : "text-muted-foreground"
              }`}
            >
              {delta > 0 ? (
                <ArrowUp className="h-3 w-3" aria-hidden />
              ) : (
                <ArrowDown className="h-3 w-3" aria-hidden />
              )}
              {delta > 0 ? "+" : ""}
              {delta}
            </span>
          )}
        </div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/**
 * One row of the Response times panel. Three of these stack in one card
 * rather than each getting its own — they answer the same question
 * ("how long do I wait?") at three different bars, and a person scanning for
 * "did I hear back at all" shouldn't have to compare three separate cards to
 * see that first response, unlike the other two, actually has a number.
 */
function ResponseTimeStat({
  label,
  hint,
  duration,
  historySince,
}: {
  label: string;
  hint?: string;
  duration: { medianDays: number; sampleSize: number } | null;
  historySince: Date | null;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b pb-3 last:border-b-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        {!duration && (
          <p className="text-xs text-muted-foreground">
            Needs two recorded transitions on the same application
            {historySince && ` — recording began ${historySince.toLocaleDateString()}`}.
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        {duration ? (
          <>
            {/* The unit rides with the number rather than living only in the
                card's own description — a screenshot of one row, cropped out
                of the card around it, should still read as "60 days", not a
                bare "60". */}
            <p className="text-2xl font-semibold tracking-[-0.02em]">
              {duration.medianDays}
              <span className="ml-1 text-sm font-normal text-muted-foreground">days</span>
            </p>
            {/* "Based on", not a bare count: this is the sample size behind
                the median above, not a separate figure — the wording says so
                without needing the reader to already know that. */}
            <p className="text-xs text-muted-foreground">
              Based on {duration.sampleSize} application{duration.sampleSize === 1 ? "" : "s"}
            </p>
          </>
        ) : (
          <p className="text-2xl font-semibold text-muted-foreground">—</p>
        )}
      </div>
    </div>
  );
}

/** Table twin for a chart — every plotted value stays reachable without colour. */
function DataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: string[][];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
        {open ? "Hide data table" : "Show data table"}
      </Button>
      {open && (
        <div className="mt-2 max-h-64 overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <caption className="sr-only">{caption}</caption>
            <thead className="bg-muted/50">
              <tr>
                {columns.map((c) => (
                  <th key={c} scope="col" className="px-3 py-2 text-left font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r[0]}>
                  {r.map((cell, i) => (
                    <td key={i} className={`px-3 py-1.5 ${i > 0 ? "tabular-nums" : ""}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <main className="container-page page-body">
      <PageHeading />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-xl" />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-[318px] rounded-xl" />
        <Skeleton className="h-[318px] rounded-xl" />
      </div>
      <Skeleton className="mt-4 h-[338px] rounded-xl" />
    </main>
  );
}
