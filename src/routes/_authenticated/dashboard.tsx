import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { statusColor, type Status } from "@/lib/status";
import {
  computeKpis,
  funnelStages,
  parseLocalDate,
  statusBreakdown,
  weeklyApplications,
  type StatsApplication,
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

type TaskWithApp = StatsTask & {
  id: string;
  title: string;
  applications: { id: string; company: string; position: string } | null;
};

const barConfig = {
  count: { label: "Applications", color: "var(--dv-bar)" },
} satisfies ChartConfig;

const stageConfig = {
  count: { label: "Applications", color: "var(--dv-stage-2)" },
} satisfies ChartConfig;

const STAGE_FILLS = ["var(--dv-stage-1)", "var(--dv-stage-2)", "var(--dv-stage-3)"];

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
        .select("*, applications:application_id (id, company, position)")
        .order("done")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  if (appsLoading || tasksLoading) return <DashboardSkeleton />;

  return (
    <DashboardView apps={apps as StatsApplication[]} tasks={tasks as unknown as TaskWithApp[]} />
  );
}

/** Presentation only — kept separate from fetching so it can be rendered with fixtures. */
export function DashboardView({ apps, tasks }: { apps: StatsApplication[]; tasks: TaskWithApp[] }) {
  const statApps = apps;
  const statTasks = tasks;

  const kpis = useMemo(() => computeKpis(statApps, statTasks), [statApps, statTasks]);
  const breakdown = useMemo(() => statusBreakdown(statApps), [statApps]);
  const weekly = useMemo(() => weeklyApplications(statApps), [statApps]);
  const funnel = useMemo(() => funnelStages(statApps), [statApps]);

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
      <main className="mx-auto max-w-6xl px-4 py-8">
        <PageHeading />
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">
              No applications yet — stats appear here once you've logged your first one.
            </p>
            <Button asChild className="mt-4">
              <Link to="/applications">
                <Plus className="mr-1 h-4 w-4" /> Add an application
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <PageHeading />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Key metrics">
        <StatTile label="Total applications" value={kpis.total} />
        <StatTile label="Active pipeline" value={kpis.active} hint="Applied or interviewing" />
        <StatTile
          label="Interview rate"
          value={kpis.interviewRate === null ? "—" : `${Math.round(kpis.interviewRate * 100)}%`}
          hint="Reached interview, by current status"
        />
        <StatTile label="Offers" value={kpis.offers} />
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
                  width={92}
                  tickMargin={6}
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Bar
                  dataKey="count"
                  fill="var(--color-count)"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={24}
                  isAnimationActive={false}
                >
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
              Current status only — an application rejected after an interview counts just as
              rejected, so these are lower bounds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={stageConfig} className="aspect-auto h-[220px] w-full">
              <BarChart
                accessibilityLayer
                data={funnel}
                layout="vertical"
                margin={{ left: 4, right: 96, top: 4, bottom: 4 }}
              >
                <CartesianGrid horizontal={false} />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="stage"
                  tickLine={false}
                  axisLine={false}
                  width={92}
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
                    <Cell key={stage.stage} fill={STAGE_FILLS[i]} />
                  ))}
                  <LabelList
                    dataKey="count"
                    position="right"
                    offset={8}
                    className="fill-foreground"
                    fontSize={12}
                    // Without an explicit width recharts inherits the bar's own
                    // width, and a short bar wraps its label onto two lines.
                    width={88}
                    formatter={(value: number) =>
                      kpis.total === 0
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
          <ChartContainer config={barConfig} className="aspect-auto h-[240px] w-full">
            <BarChart
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
              <ChartTooltip cursor={false} content={<ChartTooltipContent labelKey="label" />} />
              <Bar
                dataKey="count"
                fill="var(--color-count)"
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
                isAnimationActive={false}
              />
            </BarChart>
          </ChartContainer>
          <DataTable
            caption="Applications per week"
            columns={["Week of", "Applications"]}
            rows={weekly.map((w) => [w.label, String(w.count)])}
          />
        </CardContent>
      </Card>

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
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{t.title}</p>
                      {t.applications && (
                        <Link
                          to="/applications/$id"
                          params={{ id: t.applications.id }}
                          className="text-xs text-muted-foreground hover:underline"
                        >
                          {t.applications.position} · {t.applications.company}
                        </Link>
                      )}
                    </div>
                    <span
                      className={`shrink-0 text-xs ${overdue ? "font-medium text-destructive" : "text-muted-foreground"}`}
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

      {/* Badge renders a <div>, so this wrapper must not be a <p>. */}
      <div className="mt-4 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <span className="mr-1">Status legend:</span>
        {breakdown.map((b) => (
          <Badge
            key={b.status}
            variant="outline"
            className={`${statusColor[b.status as Status]} capitalize`}
          >
            {b.status}
          </Badge>
        ))}
      </div>
    </main>
  );
}

function PageHeading() {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      <p className="text-sm text-muted-foreground">How your search is tracking.</p>
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  delta,
  alert,
}: {
  label: string;
  value: number | string;
  hint?: string;
  delta?: number;
  alert?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="mt-1 flex items-baseline gap-2">
          {/* Proportional figures: tabular-nums makes a display-size number look loose. */}
          <span className={`text-3xl font-semibold ${alert ? "text-destructive" : ""}`}>
            {value}
          </span>
          {delta !== undefined && delta !== 0 && (
            <span className="flex items-center text-xs text-muted-foreground">
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
    <main className="mx-auto max-w-6xl px-4 py-8">
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
