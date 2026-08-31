/*
 * TEMPORARY verification route — delete before merging.
 *
 * Renders DashboardView and ApplicationCard against fixtures so the recharts 3
 * upgrade and the job-type chip change can be checked without a live session.
 */
import { createFileRoute, notFound } from "@tanstack/react-router";
import { DashboardView } from "./_authenticated/dashboard";
import { ApplicationCard, type ApplicationCardData } from "@/components/ApplicationCard";
import type { Status } from "@/lib/status";
import type { StatsApplication, StatsStatusEvent } from "@/lib/stats";

export const Route = createFileRoute("/dev-preview")({
  /*
   * Dev only. This is a fixture page — invented companies, invented offers —
   * and a file-based route is public the moment it is deployed, so without
   * this guard the marketing site ships a fake dashboard on a real URL that
   * search engines are free to index. The route still exists in the bundle;
   * it just refuses to render anywhere but a dev server.
   */
  beforeLoad: () => {
    if (import.meta.env.PROD) throw notFound();
  },
  component: DevPreview,
});

const iso = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};

const STATUS_CYCLE: Status[] = [
  "applied",
  "applied",
  "interviewing",
  "rejected",
  "applied",
  "offer",
  "withdrawn",
  "interviewing",
  "rejected",
  "applied",
];

// ~150 days of history so the weekly trend and monthly cohorts both fill.
const apps: StatsApplication[] = Array.from({ length: 46 }, (_, i) => ({
  id: `app-${i}`,
  status: STATUS_CYCLE[i % STATUS_CYCLE.length],
  application_date: iso(Math.floor((i * 150) / 46) + (i % 4)),
}));

// Give the interviewed/offered ones a real transition pair so "Time to
// interview" and "Stage reach" have something beyond current status.
const events: StatsStatusEvent[] = apps.flatMap((a) => {
  const base: StatsStatusEvent[] = [
    {
      application_id: a.id,
      status: "applied",
      changed_at: a.application_date,
      created_at: a.application_date,
    },
  ];
  if (a.status === "interviewing" || a.status === "offer") {
    const d = new Date(a.application_date);
    d.setDate(d.getDate() + 9);
    const later = d.toISOString().slice(0, 10);
    base.push({
      application_id: a.id,
      status: "interviewing",
      changed_at: later,
      created_at: later,
    });
  }
  return base;
});

const tasks = [
  { id: "t1", title: "Send follow-up to hiring manager", done: false, due_date: iso(2) },
  { id: "t2", title: "Prep system design round", done: false, due_date: iso(-3) },
  { id: "t3", title: "Take-home: submit by Friday", done: false, due_date: iso(-8) },
  { id: "t4", title: "Ask about relocation package", done: false, due_date: iso(-12) },
  { id: "t5", title: "Update CV with new project", done: true, due_date: iso(20) },
].map((t) => ({
  ...t,
  task_applications: [
    { application: { id: "app-1", company: "Northwind", position: "Staff Engineer" } },
  ],
}));

const cards: ApplicationCardData[] = [
  {
    id: "app-1",
    company: "Northwind",
    position: "Staff Engineer",
    status: "applied",
    priority: true,
    application_date: iso(6),
    notes: "Referred by Dana",
    website: "https://stripe.com",
    job_type: "remote",
    country: "Germany",
    city: "Berlin",
    task_applications: [
      { task: { id: "t1", due_date: iso(2), done: false, priority: true } },
      { task: { id: "t2", due_date: iso(-3), done: false, priority: false } },
    ],
  },
  {
    id: "app-2",
    company: "Contoso",
    position: "Senior Frontend Engineer",
    status: "interviewing",
    priority: false,
    application_date: iso(14),
    notes: null,
    website: "https://linear.app",
    job_type: "hybrid",
    country: "United Kingdom",
    city: "London",
    task_applications: [{ task: { id: "t3", due_date: iso(-8), done: false, priority: false } }],
  },
  {
    id: "app-3",
    company: "Initech",
    position: "Platform Engineer",
    status: "rejected",
    priority: false,
    application_date: iso(44),
    notes: "Nice team, wrong stack",
    website: null,
    job_type: "onsite",
    country: "Lithuania",
    city: "Vilnius",
    task_applications: [],
  },
  {
    // Active status, no open tasks, >30d old — the "stalled" branch.
    id: "app-5",
    company: "Globex",
    position: "Backend Engineer",
    status: "applied",
    priority: false,
    application_date: iso(52),
    notes: null,
    website: null,
    job_type: "hybrid",
    country: "Poland",
    city: "Warsaw",
    task_applications: [],
  },
  {
    id: "app-4",
    company: "Umbrella",
    position: "Engineering Manager",
    status: "offer",
    priority: false,
    application_date: iso(38),
    notes: null,
    website: "https://vercel.com",
    job_type: "remote",
    country: "United States",
    city: null,
    task_applications: [],
  },
];

function DevPreview() {
  return (
    <div>
      <DashboardView apps={apps} tasks={tasks as never} events={events} />
      <main className="container-page pb-20">
        <h2 className="mb-3 text-lg font-semibold">ApplicationCard — list</h2>
        <div className="space-y-3">
          {cards.map((c) => (
            <ApplicationCard key={c.id} app={c} variant="list" onTogglePriority={() => {}} />
          ))}
        </div>
        <h2 className="mb-3 mt-8 text-lg font-semibold">ApplicationCard — grid</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <ApplicationCard key={c.id} app={c} variant="grid" onTogglePriority={() => {}} />
          ))}
        </div>
      </main>
    </div>
  );
}
