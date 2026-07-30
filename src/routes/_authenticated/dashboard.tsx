import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
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
  computeKpis,
  eventsBeyondCurrentStatus,
  funnelStages,
  historyStartedAt,
  medianDaysBetweenStages,
  monthlyCohorts,
  parseLocalDate,
  statusBreakdown,
  weeklyApplications,
  PIPELINE,
  type StatsApplication,
  type StatsStatusEvent,
  type StatsTask,
} from "@/lib/stats";
import { ArrowDown, ArrowUp, Plus, TriangleAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Job Tracker" },
      { name: "description", content: "Pipeline stats across all your job applications." },
      { property: "og:title", content: "Dashboard — Job Tracker" },
      { property: "og:description", content: "Pipeline stats across all your job applications." },
    ],
  }),
  component: DashboardPage,
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
 * dashboard needs no legend of its own to be read — the one under the heading
 * is a key to the whole vocabulary, not an index of these particular charts.
 *
 * Where a chart counts applications generally rather than by outcome
 * (per-week volume, cohort size) it takes `applied` blue: those are
 * applications you sent, which is what blue means everywhere else here.
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
 * Every <Bar> below sets `isAnimationActive={false}` deliberately.
 *
 * recharts 2.15.4 animates bars in via react-smooth, which does not run under
 * React 19.2 — the enter animation never advances, so the rectangles stay at
 * zero size and the chart renders axes with no bars at all. Disabling the
 * animation makes them draw at their final geometry. Revisit if recharts is
 * upgraded to a version that supports React 19 properly.
 */

function DashboardPage() {
  // Same query keys as the applications and tasks pages, so navigating between
  // them reuses one cache entry instead of refetching.
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

  if (appsLoading || tasksLoading || eventsLoading) return <DashboardSkeleton />;

  return (
    <DashboardView
      apps={apps as StatsApplication[]}
      tasks={tasks as unknown as TaskWithApp[]}
      events={events as StatsStatusEvent[]}
    />
  );
}

/** Presentation only — kept separate from fetching so it can be rendered with fixtures. */
export function DashboardView({
  apps,
  tasks,
  events = [],
}: {
  apps: StatsApplication[];
  tasks: TaskWithApp[];
  events?: StatsStatusEvent[];
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
  // 86px is the measured width of the longest tick ("Interviewing") at 11px —
  // anything narrower clips its first character rather than wrapping.
  const axisWidth = isMobile ? 86 : 92;
  const axisTick = isMobile ? { fontSize: 11 } : undefined;
  const labelGutter = isMobile ? 30 : 96;

  const kpis = useMemo(() => computeKpis(statApps, statTasks), [statApps, statTasks]);
  const breakdown = useMemo(() => statusBreakdown(statApps), [statApps]);
  const weekly = useMemo(() => weeklyApplications(statApps), [statApps]);
  const funnel = useMemo(() => funnelStages(statApps, events), [statApps, events]);
  const cohorts = useMemo(() => monthlyCohorts(statApps, events), [statApps, events]);
  const daysToInterview = useMemo(
    () => medianDaysBetweenStages(events, "applied", "interviewing"),
    [events],
  );
  const historyDepth = useMemo(
    () => eventsBeyondCurrentStatus(statApps, events),
    [statApps, events],
  );
  const historySince = useMemo(() => historyStartedAt(events), [events]);

  const upcoming = useMemo(() => {
    const today = new Date();
    const horizon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14);
    return statTasks
      .filter((t) => !t.done && t.due_date !== null)
      .filter((t) => parseLocalDate(t.due_date as string) <= horizon)
      .slice(0, 8);
  }, [statTasks]);

  if (apps.length === 0) {
    return (
      <main className="container-page page-body">
        <PageHeading />
        <EmptyState
          title="No applications yet"
          body="Stats appear here once you've logged your first one."
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
      <PageHeading />
      <StatusLegend />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Key metrics">
        <StatTile label="Total applications" value={kpis.total} />
        <StatTile
          label="Active pipeline"
          value={kpis.active}
          hint="Applied or interviewing"
          accent="applied"
        />
        {/* Reads from the same funnel as the Stage reach chart, so the two can
            never disagree on screen. */}
        <StatTile
          label="Interview rate"
          value={kpis.total === 0 ? "—" : `${Math.round((funnel[1]?.share ?? 0) * 100)}%`}
          hint={
            historyDepth > 0 ? "Ever reached interview" : "Ever reached interview (lower bound)"
          }
          accent="interviewing"
        />
        <StatTile label="Offers" value={kpis.offers} accent="offer" />
        <StatTile
          label="Applied in last 7 days"
          value={kpis.lastSeven}
          delta={kpis.lastSevenDelta}
          hint="vs previous 7 days"
        />
        <StatTile
          label="Overdue tasks"
          value={kpis.overdueTasks}
          alert={kpis.overdueTasks > 0}
          hint={`${kpis.openTasks} open in total`}
        />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Applications by status</CardTitle>
            <CardDescription>Where all {kpis.total} applications stand right now.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={barConfig} className="aspect-auto h-[220px] w-full">
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
                  How far each application got, including {historyDepth} that moved past a stage
                  before reaching {historyDepth === 1 ? "its" : "their"} current status.
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
            <ChartContainer config={stageConfig} className="aspect-auto h-[220px] w-full">
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
                    formatter={(value: number) =>
                      kpis.total === 0 || isMobile
                        ? `${value}`
                        : `${value} (${Math.round((value / kpis.total) * 100)}%)`
                    }
                  />
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </section>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Applications per week</CardTitle>
          <CardDescription>Last 12 weeks, by the date you applied.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* A line, not columns: this panel is about the shape of the last
              twelve weeks — where the search sped up and where it stalled —
              and a trend is what a line is for. Zero weeks are real zeros, so
              the line touches the baseline rather than breaking. */}
          <ChartContainer config={barConfig} className="aspect-auto h-[240px] w-full">
            <AreaChart
              accessibilityLayer
              data={weekly}
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
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartContainer>
          <DataTable
            caption="Applications per week"
            columns={["Week of", "Applications"]}
            rows={weekly.map((w) => [w.label, String(w.count)])}
          />
        </CardContent>
      </Card>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Interview conversion by cohort</CardTitle>
            <CardDescription>
              Applications grouped by the month you sent them, and how many ever reached an
              interview. Recent months have had less time to convert.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={cohortConfig} className="aspect-auto h-[220px] w-full">
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
              columns={["Month", "Applied", "Reached interview", "Rate"]}
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
            <CardTitle className="text-base">Time to interview</CardTitle>
            <CardDescription>Median days from applying to the first interview.</CardDescription>
          </CardHeader>
          <CardContent>
            {daysToInterview ? (
              <>
                <p className="text-3xl font-semibold">{daysToInterview.medianDays}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  days, across {daysToInterview.sampleSize} application
                  {daysToInterview.sampleSize === 1 ? "" : "s"} with both transitions recorded
                </p>
              </>
            ) : (
              <>
                <p className="text-3xl font-semibold text-muted-foreground">—</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Needs two recorded transitions on the same application. This can&apos;t be
                  reconstructed from current status, so it fills in as you move applications through
                  the pipeline
                  {historySince && ` — recording began ${historySince.toLocaleDateString()}`}.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Next 14 days</CardTitle>
          <CardDescription>Open tasks coming due, soonest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing due in the next two weeks.{" "}
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
        </CardContent>
      </Card>
    </main>
  );
}

/**
 * The key to the colour language, and it belongs above the charts it explains
 * — at the foot it sat below the fold, which is the one place a legend is no
 * use. It lists all five statuses rather than only the ones currently in the
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

function PageHeading() {
  return <PageHeader title="Dashboard" description="How your search is tracking." />;
}

/**
 * `accent` ties a tile to the status it counts. It rides a dot next to the
 * label rather than the figure: a number is text, and text stays in text ink
 * so it keeps its full contrast — the swatch beside it is what carries the
 * hue. `alert` is the one exception, because an overdue count is a warning
 * rather than an identity, and its label says so in words either way.
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
  return (
    <Card>
      <CardContent className="p-5">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {accent && (
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: statusFill[accent] }}
            />
          )}
          {label}
        </p>
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

function DashboardSkeleton() {
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
