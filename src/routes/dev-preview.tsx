/*
 * Fixture route for previewing DashboardView and ApplicationCard against
 * canned data — no live session required. Handy for checking visual changes
 * and for grabbing screenshots. Kept intentionally; guarded below so it never
 * renders in production.
 */
import { useState } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { DashboardView } from "./_authenticated/dashboard";
import { ApplicationCard, type ApplicationCardData } from "@/components/ApplicationCard";
import { ApplicationBoard } from "@/components/ApplicationBoard";
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
  "wishlist",
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
  // A wishlist row was never applied to, so it logs a `wishlist` event and
  // nothing more. Handing it an `applied` event instead would put it in the
  // funnel, and the funnel would then report more applications than the KPI
  // tiles say exist — exactly the disagreement the real schema must not have.
  if (a.status === "wishlist") {
    return [
      {
        application_id: a.id,
        status: "wishlist" as const,
        changed_at: a.application_date,
        created_at: a.application_date,
      },
    ];
  }
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
    // Clipped by the extension, never applied to — the wishlist branch.
    id: "app-6",
    company: "Hooli",
    position: "Design Engineer",
    status: "wishlist",
    priority: false,
    application_date: iso(3),
    notes: null,
    website: "https://figma.com",
    job_type: "remote",
    country: "Netherlands",
    city: "Amsterdam",
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    salary_period: null,
    time_zone: null,
    task_applications: [],
  },
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
    salary_min: 95000,
    salary_max: 130000,
    salary_currency: "EUR",
    salary_period: "year",
    time_zone: null,
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
    salary_min: null,
    salary_max: 90000,
    salary_currency: "GBP",
    salary_period: "year",
    time_zone: null,
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
    salary_min: 5500,
    salary_max: 7000,
    salary_currency: "EUR",
    salary_period: "month",
    time_zone: null,
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
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    salary_period: null,
    time_zone: "America/Los_Angeles",
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
    salary_min: 140000,
    salary_max: null,
    salary_currency: "USD",
    salary_period: "year",
    time_zone: null,
    task_applications: [],
  },
];

/*
 * Filler for the board, which is the one component whose bugs only appear at
 * volume: a column has to overflow its preview cap before the "Show N more"
 * control exists at all.
 *
 * The first entry carries a deliberately long title and a long city. The card
 * title is `truncate`, so white-space:nowrap makes its min-content the whole
 * string, and a card that is allowed to take its min-content width spills out
 * of its column and paints over the next one. That was a real bug; this row is
 * what would show it again.
 */
const filler: ApplicationCardData[] = [
  "Senior Staff Infrastructure Engineer, Developer Platform",
  "Product Manager",
  "Data Engineer",
  "Solutions Architect",
  "Growth Marketer",
  "QA Automation Engineer",
].map((position, i) => ({
  id: `fill-${i}`,
  company: ["Aperture", "Cyberdyne", "Tyrell", "Soylent", "Wonka", "Gringotts"][i],
  position,
  status: "applied" as const,
  priority: false,
  application_date: iso(7 + i * 3),
  notes: null,
  website: null,
  job_type: i % 2 === 0 ? "onsite" : "remote",
  country: i === 0 ? "United States" : null,
  city: i === 0 ? "San Francisco" : null,
  salary_min: null,
  salary_max: null,
  salary_currency: null,
  salary_period: null,
  time_zone: null,
  task_applications: [],
}));

function DevPreview() {
  // The board is stateful in a way the cards are not — dragging has to land
  // somewhere — so the fixture holds its own copy and mutates it locally.
  const [boardCards, setBoardCards] = useState([...cards, ...filler]);

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
        {/* app-3 (Initech, rejected) is in this fixture set deliberately: the
            board must never render a closed application in any column — the
            whole mechanism by which "closed" leaves the board is that it has
            nowhere to go, and this is the fixture that would show a leak. */}
        <h2 className="mb-3 mt-8 text-lg font-semibold">ApplicationBoard</h2>
        <ApplicationBoard
          apps={boardCards}
          onTogglePriority={(app, priority) =>
            setBoardCards((prev) => prev.map((c) => (c.id === app.id ? { ...c, priority } : c)))
          }
          onMoveTo={(app, status) =>
            setBoardCards((prev) => prev.map((c) => (c.id === app.id ? { ...c, status } : c)))
          }
        />
      </main>
    </div>
  );
}
