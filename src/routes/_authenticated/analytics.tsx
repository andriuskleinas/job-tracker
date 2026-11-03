import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { subDays } from "date-fns";
import { z } from "zod";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { statusFill, type Status } from "@/lib/status";
import { summarizeRejections, type RejectionFields, type RejectionSummary } from "@/lib/rejection";
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
  type FunnelStage,
} from "@/lib/stats";
import { ArrowDown, ArrowUp, ArrowDownRight, Info, Plus, Quote, Table2 } from "lucide-react";

/*
 * The date-range filter lives in the URL, same reasoning as the
 * applications page's filters: a filtered analytics page is shareable,
 * survives a refresh, and works with the back button. `range=custom`
 * without both `from`/`to` present falls back to "all" — a half-specified
 * custom range is not a range.
 */
const searchSchema = z.object({
  range: z.enum(RANGE_PRESETS).catch("all").optional(),
  from: z.string().catch("").optional(),
  to: z.string().catch("").optional(),
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

/*
 * Colour on this page is the status language from `@/lib/status`, nothing
 * else. A bar and a badge that share a hue always share a meaning — and every
 * coloured mark here sits beside the status name it stands for, so the page
 * needs no separate legend to be read.
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

// The total is a faint ink column with the interviews drawn inside it, so the
// cohort reads as one shape — how much of it turned gold — rather than two
// bars side by side that leave the reader to do the division.
const cohortConfig = {
  applied: {
    label: "Applied",
    color: "color-mix(in oklch, var(--status-applied) 16%, transparent)",
  },
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

  // Only feeds the task tiles below. The select has to stay identical to the
  // applications page's task panel — both read the same `["tasks", "all"]`
  // cache entry, and whichever mounts first is the one that fills it.
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

  // resetScroll: false — changing the range should not jump the page back to
  // the top.
  const setRange = (patch: Partial<AnalyticsSearch>) =>
    navigate({ search: { ...search, ...patch }, replace: true, resetScroll: false });

  return (
    <AnalyticsView
      apps={apps as StatsApplication[]}
      tasks={tasks as StatsTask[]}
      events={events as StatsStatusEvent[]}
      range={search.range ?? "all"}
      customFrom={search.from ? parseLocalDate(search.from) : null}
      customTo={search.to ? parseLocalDate(search.to) : null}
      onPresetChange={(range) => setRange({ range, from: undefined, to: undefined })}
      onCustomChange={(from, to) => setRange({ range: "custom", from: toIso(from), to: toIso(to) })}
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
}: {
  apps: (StatsApplication & Partial<RejectionFields>)[];
  tasks: StatsTask[];
  events?: StatsStatusEvent[];
  range?: RangePreset;
  customFrom?: Date | null;
  customTo?: Date | null;
  onPresetChange?: (range: Exclude<RangePreset, "custom">) => void;
  onCustomChange?: (from: Date, to: Date) => void;
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
    () =>
      conversionCohorts(periodApps, periodEvents, from, to, cohortGranularity).map((c) => ({
        ...c,
        // Printed above each column, so the rate is read, not worked out.
        rateLabel: c.rate === null ? "" : `${Math.round(c.rate * 100)}%`,
      })),
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
  const rejections = useMemo(() => summarizeRejections(periodApps), [periodApps]);

  const trendTotal = trend.reduce((sum, b) => sum + b.count, 0);
  const trendAverage = trend.length > 0 ? trendTotal / trend.length : 0;
  const perUnit =
    trendGranularity === "day" ? "day" : trendGranularity === "week" ? "week" : "month";

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
      {/* One panel of figures rather than six cards: the hairlines between
          cells group them as one reading, and the page loses five borders
          and five shadows competing with the charts below. */}
      <Card className="overflow-hidden p-0">
        <section
          aria-label="Key metrics"
          className="grid grid-cols-2 gap-px bg-border lg:grid-cols-3"
        >
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
                  : sentenceCase(periodLabel)
            }
            visual={trend.length > 1 && <Sparkline data={trend} />}
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
            visual={
              funnelTotal > 0 && <Meter share={funnel[1]?.share ?? 0} status="interviewing" />
            }
          />
          <StatTile
            label="Offers"
            value={period.offers}
            hint={sentenceCase(periodLabel)}
            accent="offer"
          />
          {/* The applications that are still technically alive but have gone
              quiet. Distinct from Overdue tasks — this fires with no task
              involved at all, which is exactly the case a task list can't
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
      </Card>

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
            <BarList
              label="Applications by status"
              rows={breakdown.map((b) => ({
                key: b.status,
                label: b.label,
                count: b.count,
                share: periodApps.length === 0 ? 0 : b.count / periodApps.length,
                status: b.status as Status,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-base">
              Stage reach
              <InfoTip>
                {historyDepth > 0 ? (
                  <>
                    Counts how far each application got, including {historyDepth} that moved past a
                    stage before reaching {historyDepth === 1 ? "its" : "their"} current status.
                  </>
                ) : (
                  <>
                    Still current-status only — no recorded transition yet credits an application
                    with a stage its status doesn&apos;t already show, so these are lower bounds.
                    {historySince &&
                      ` Transitions recorded since ${historySince.toLocaleDateString()}.`}
                  </>
                )}
              </InfoTip>
            </CardTitle>
            <CardDescription>How far your applications from {periodLabel} got.</CardDescription>
          </CardHeader>
          <CardContent>
            <Funnel stages={funnel} />
          </CardContent>
        </Card>
      </section>

      <Card className="mt-4">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="space-y-1.5">
            <CardTitle className="text-base">Applications per {perUnit}</CardTitle>
            <CardDescription>{sentenceCase(periodLabel)}, by the date you applied.</CardDescription>
          </div>
          {/* The two numbers the shape is about, so the chart needn't be read
              off the axis to get them. */}
          <dl className="flex gap-6 text-right">
            <div>
              <dt className="text-xs text-muted-foreground">Total</dt>
              <dd className="text-xl font-semibold tracking-[-0.02em]">{trendTotal}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Average per {perUnit}</dt>
              <dd className="text-xl font-semibold tracking-[-0.02em]">
                {trendAverage.toFixed(trendAverage >= 10 ? 0 : 1)}
              </dd>
            </div>
          </dl>
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
              margin={{ left: 4, right: 8, top: 12, bottom: 4 }}
            >
              <defs>
                <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-count)" stopOpacity={0.16} />
                  <stop offset="100%" stopColor="var(--color-count)" stopOpacity={0} />
                </linearGradient>
              </defs>
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
              {trendAverage > 0 && (
                <ReferenceLine
                  y={trendAverage}
                  stroke="var(--muted-foreground)"
                  strokeOpacity={0.5}
                  ifOverflow="extendDomain"
                  label={{
                    value: "avg",
                    position: "insideTopRight",
                    fontSize: 11,
                    fill: "var(--muted-foreground)",
                  }}
                />
              )}
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--color-count)"
                strokeWidth={2}
                // A wash that fades to nothing, so the line has a body to
                // read against without a grey block under it.
                fill="url(#trend-fill)"
                // No marker on every point — the tooltip and the active dot
                // carry exact values; the line carries the shape.
                dot={false}
                activeDot={{ r: 4.5, strokeWidth: 2, stroke: "var(--card)" }}
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
            <CardTitle className="flex items-center gap-1.5 text-base">
              Interview conversion by cohort
              <InfoTip>
                Applications grouped by the {cohortGranularity === "week" ? "week" : "month"} you
                sent them, and how many ever reached an interview. Recent cohorts have had less time
                to convert.
              </InfoTip>
            </CardTitle>
            <CardDescription>
              Of what you sent each {cohortGranularity === "week" ? "week" : "month"}, how much
              reached an interview.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={cohortConfig}
              className="chart-bars-v aspect-auto h-[240px] w-full"
            >
              <BarChart
                accessibilityLayer
                data={cohorts}
                // A negative gap the width of a bar draws the subset inside
                // its total instead of beside it.
                barGap={-24}
                margin={{ left: 4, right: 4, top: 20, bottom: 4 }}
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
                <ChartTooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                  content={<ChartTooltipContent labelKey="label" />}
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  dataKey="applied"
                  fill="var(--color-applied)"
                  radius={[4, 4, 0, 0]}
                  barSize={24}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="rateLabel"
                    position="top"
                    offset={6}
                    className="fill-foreground"
                    fontSize={11}
                    fontWeight={500}
                  />
                </Bar>
                <Bar
                  dataKey="reachedInterview"
                  fill="var(--color-reachedInterview)"
                  radius={[4, 4, 0, 0]}
                  barSize={24}
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

      <RejectionReasons summary={rejections} periodLabel={periodLabel} />
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
 * One cell of the key-metrics panel.
 *
 * `accent` ties a tile to the status it counts, and `alert` marks a tile that
 * is a warning rather than an identity. Either way the hue rides a marker
 * beside the label, never the figure: a number is text, and text stays in
 * text ink so it keeps its full contrast. The marker is 8px — the old 2px dot
 * was a smudge in gold — and every one sits next to a label that names it.
 *
 * `visual` is an optional mark at the figure's right: the trend's shape for
 * the applications count, a meter for a rate.
 */
function StatTile({
  label,
  value,
  hint,
  delta,
  alert,
  accent,
  visual,
}: {
  label: string;
  value: number | string;
  hint?: string;
  delta?: number;
  alert?: boolean;
  accent?: Status;
  visual?: ReactNode;
}) {
  // Overdue work is the one warning on this page, and it wears the same red the
  // overdue chips on the cards and tasks list wear.
  const mark = alert ? "var(--status-rejected)" : accent ? statusFill[accent] : null;

  return (
    <div className="flex min-w-0 flex-col bg-card p-4 sm:p-5">
      <p className="flex items-start gap-2 text-sm leading-snug text-muted-foreground">
        {mark && (
          <span
            aria-hidden
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
            style={{ background: mark }}
          />
        )}
        {label}
      </p>
      <div className="mt-1.5 flex items-end justify-between gap-4">
        <div className="flex items-baseline gap-2">
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
        {visual && (
          <div aria-hidden className="mb-1.5 hidden w-28 shrink-0 sm:block">
            {visual}
          </div>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * The period's applications as a running total — no axes, no values; the
 * chart below has those. Cumulative rather than per-bucket because at this
 * size a week-to-week line of ones and threes is a zigzag, while a running
 * total shows the one thing a glance can take in: is the count still
 * climbing, and where did it flatten.
 */
function Sparkline({ data }: { data: { label: string; count: number }[] }) {
  const running = useMemo(() => {
    let sum = 0;
    return data.map((d) => ({ label: d.label, count: (sum += d.count) }));
  }, [data]);
  return (
    <ChartContainer config={barConfig} className="aspect-auto h-9 w-full">
      <AreaChart data={running} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-count)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--color-count)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="count"
          stroke="var(--color-count)"
          strokeWidth={1.5}
          fill="url(#spark-fill)"
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

/** A rate as a filled track, in the colour of the status it measures. */
function Meter({ share, status }: { share: number; status: Status }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.max(2, Math.round(share * 100))}%`,
          background: statusFill[status],
        }}
      />
    </div>
  );
}

/** The grow-in shared by every HTML bar on the page; off under reduced motion. */
const BAR_GROW = "origin-left motion-safe:animate-[bar-grow-x_480ms_cubic-bezier(0.2,0.8,0.2,1)]";

/**
 * Horizontal bars in plain HTML: label, bar on a faint track, then the count
 * and its share. The track gives every bar the same full length to be read
 * against, so a short bar reads as a fraction of something rather than a
 * stray block; the numbers sit in their own column so they line up.
 */
function BarList({
  label,
  rows,
}: {
  label: string;
  rows: { key: string; label: string; count: number; share: number; status: Status }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul aria-label={label} className="space-y-3">
      {rows.map((r) => (
        <li
          key={r.key}
          className="grid grid-cols-[5.5rem_minmax(0,1fr)_4.75rem] items-center gap-3 text-sm sm:grid-cols-[6.5rem_minmax(0,1fr)_5rem]"
        >
          <span className="truncate text-muted-foreground">{r.label}</span>
          <span className="h-5 overflow-hidden rounded-r-[4px] bg-muted/70">
            {r.count > 0 && (
              <span
                className={`block h-full rounded-r-[4px] ${BAR_GROW}`}
                style={{ width: `${(r.count / max) * 100}%`, background: statusFill[r.status] }}
              />
            )}
          </span>
          <span className="text-right tabular-nums">
            <span className="font-medium">{r.count}</span>
            <span className="ml-1.5 text-xs text-muted-foreground">
              {Math.round(r.share * 100)}%
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Stage reach as a funnel: each stage's bar is its share of applications
 * sent, centred so the narrowing reads at a glance, and between stages the
 * step rate — how many of the stage above made it to this one — which is the
 * number the old bar chart left the reader to work out.
 */
function Funnel({ stages }: { stages: FunnelStage[] }) {
  return (
    <ol aria-label="Stage reach" className="space-y-1">
      {stages.map((st, i) => {
        const prev = stages[i - 1];
        const step = prev && prev.count > 0 ? st.count / prev.count : null;
        return (
          <li key={st.stage}>
            {prev && (
              <p className="flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground">
                <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />
                {step === null ? (
                  "—"
                ) : (
                  <>
                    <span className="font-medium text-foreground">{Math.round(step * 100)}%</span>{" "}
                    of {prev.stage.toLowerCase()} reached {st.stage.toLowerCase()}
                  </>
                )}
              </p>
            )}
            <div className="flex items-baseline justify-between text-sm">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full"
                  style={{ background: statusFill[PIPELINE[i]] }}
                />
                {st.stage}
              </span>
              <span className="tabular-nums">
                <span className="font-medium">{st.count}</span>
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {Math.round(st.share * 100)}%
                </span>
              </span>
            </div>
            <div className="mt-1.5 flex h-6 justify-center rounded-[4px] bg-muted/70">
              {st.count > 0 && (
                <div
                  className="h-full rounded-[4px] motion-safe:animate-[bar-grow-x_480ms_cubic-bezier(0.2,0.8,0.2,1)]"
                  style={{
                    width: `${Math.max(2, st.share * 100)}%`,
                    background: statusFill[PIPELINE[i]],
                  }}
                />
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The fine print behind a chart — how it's counted and where it's a lower
 * bound — one hover away instead of a paragraph above every plot.
 */
function InfoTip({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="How this is counted"
            className="rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed font-normal">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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

/**
 * Why rejections happened: the most common reason called out on its own, then
 * every reason as a cloud, with the words that recur in your notes trailing
 * underneath as quieter text.
 *
 * Size carries the frequency, but never alone — every tag also prints its
 * count, so the cloud reads correctly for someone who can't judge type size
 * and still survives a screenshot. Tags wear the rejected status colour,
 * deeper for the common ones; note words stay in text ink so the structured
 * answer and the free-form one never blur together.
 *
 * Sorted, not scattered: a real word cloud places words randomly, which is
 * pretty and impossible to scan. Largest-first in a centred wrap keeps the
 * shape and puts the answer where the eye starts.
 */
function RejectionReasons({
  summary,
  periodLabel,
}: {
  summary: RejectionSummary;
  periodLabel: string;
}) {
  const { rejected, withReason, tags, words } = summary;
  const missing = rejected - withReason;
  const topCount = tags[0]?.count ?? 0;
  const top = tags.filter((t) => t.count === topCount);

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Rejection reasons</CardTitle>
        <CardDescription>
          {rejected === 0
            ? `No rejections from ${periodLabel}.`
            : withReason === 0
              ? `None of the ${rejected} rejection${rejected === 1 ? "" : "s"} from ${periodLabel} has a reason yet — add one from a rejected application's card menu.`
              : `${rejected} rejection${rejected === 1 ? "" : "s"} in ${periodLabel}${missing > 0 ? `, ${missing} without a reason` : ""}.`}
        </CardDescription>
      </CardHeader>
      {withReason > 0 && (
        <CardContent
          className={`grid gap-4 ${top.length > 0 ? "md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]" : ""}`}
        >
          {top.length > 0 && (
            <div className="flex flex-col justify-center rounded-xl border border-[var(--status-rejected-soft)] p-5">
              <p className="text-5xl font-semibold tracking-[-0.03em] text-[var(--status-rejected-text)]">
                {Math.round((topCount / withReason) * 100)}%
              </p>
              <p className="mt-2 text-lg leading-snug font-medium">
                {top.map((t) => t.label).join(" & ")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {topCount} of {withReason} rejection{withReason === 1 ? "" : "s"}
                {top.length > 1 ? " each" : ""}
              </p>
            </div>
          )}
          <div
            className="flex min-h-[10rem] flex-col items-center justify-center gap-5 rounded-xl px-4 py-6"
            style={{
              // A faint glow behind the cloud's centre, where the biggest
              // reasons sit, so the shape reads as one thing.
              background:
                "radial-gradient(ellipse at center, color-mix(in oklch, var(--status-rejected-soft) 60%, transparent), transparent 70%)",
            }}
          >
            {tags.length > 0 && (
              <ul
                aria-label="Reasons picked"
                className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2.5"
              >
                {tags.map((t) => {
                  const w = cloudWeight(t.count, tags);
                  return (
                    <li
                      key={t.key}
                      title={`${t.label}: ${t.count} rejection${t.count === 1 ? "" : "s"}`}
                      style={{
                        fontSize: `${0.875 + 0.875 * w}rem`,
                        fontWeight: Math.round(450 + 200 * w),
                        // The wash deepens with frequency, from a hint to the
                        // full soft tint the rejection chips elsewhere wear.
                        background: `color-mix(in oklch, var(--status-rejected-soft) ${Math.round(55 + 45 * w)}%, var(--card))`,
                      }}
                      className="inline-flex items-center gap-2 rounded-full px-3.5 py-1 leading-tight text-[var(--status-rejected-text)] shadow-xs"
                    >
                      {t.label}
                      <span className="rounded-full bg-card px-1.5 text-[0.6875rem] font-medium tabular-nums">
                        {t.count}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {words.length > 0 && (
              <div className="flex max-w-xl items-start gap-2">
                <Quote
                  aria-hidden
                  className="mt-1 h-4 w-4 shrink-0 text-[var(--status-rejected-text)] opacity-60"
                />
                <ul
                  aria-label="Words from your notes"
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
                >
                  {words.map((w) => {
                    const weight = cloudWeight(w.count, words);
                    return (
                      <li
                        key={w.word}
                        title={`${w.word}: in ${w.count} note${w.count === 1 ? "" : "s"}`}
                        style={{ fontSize: `${0.8125 + 0.4375 * weight}rem` }}
                        className={`italic ${weight > 0.5 ? "font-medium text-foreground" : "text-muted-foreground"}`}
                      >
                        {w.word}
                        {w.count > 1 && (
                          <sup className="ml-0.5 text-[0.625rem] not-italic tabular-nums text-muted-foreground">
                            {w.count}
                          </sup>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/**
 * 0 for the rarest item in a cloud, 1 for the most common. With every count
 * equal the cloud renders at its middle size rather than all-large or
 * all-small.
 */
function cloudWeight(count: number, items: { count: number }[]): number {
  const counts = items.map((i) => i.count);
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  return max === min ? 0.5 : (count - min) / (max - min);
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
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-muted-foreground"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Table2 className="h-3.5 w-3.5" />
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
      <Skeleton className="h-[236px] rounded-xl" />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-[318px] rounded-xl" />
        <Skeleton className="h-[318px] rounded-xl" />
      </div>
      <Skeleton className="mt-4 h-[338px] rounded-xl" />
    </main>
  );
}
