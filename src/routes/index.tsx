import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarClock,
  Check,
  FileUp,
  History,
  Layers,
  LineChart,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";
import { CompanyLogo } from "@/components/CompanyLogo";
import { Badge } from "@/components/ui/badge";
import { statusColor, statusFill } from "@/lib/status";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Job Tracker — Your whole job search in one place" },
      {
        name: "description",
        content:
          "Track applications, interviews and follow-ups in a single workspace. Always know what's live, what's next, and what needs a nudge today.",
      },
      { property: "og:title", content: "Job Tracker — Your whole job search in one place" },
      {
        property: "og:description",
        content:
          "Track applications, interviews and follow-ups in a single workspace. Always know what's live, what's next, and what needs a nudge today.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main>
      <Hero />
      <LogoBand />
      <Features />
      <ClosingCta />
      <Footer />
    </main>
  );
}

/*
 * The companies shown across this page.
 *
 * `website` is the whole point: it is the same field the application form
 * collects, and it goes through the same CompanyLogo component the board uses,
 * so every mark on this page is fetched live exactly the way a real row
 * fetches it. Nothing here is a bundled asset or a screenshot — if the logo
 * pipeline breaks, the homepage shows it first.
 *
 * These are examples of employers a person might be tracking, not customers,
 * partners or endorsers, and the copy beside them says so. Keep it that way:
 * the moment this strip reads as a client list it is a claim we cannot make.
 */
const COMPANIES = [
  { name: "Stripe", website: "https://stripe.com" },
  { name: "Figma", website: "https://figma.com" },
  { name: "Notion", website: "https://notion.so" },
  { name: "Linear", website: "https://linear.app" },
  { name: "Spotify", website: "https://spotify.com" },
  { name: "Airbnb", website: "https://airbnb.com" },
  { name: "Shopify", website: "https://shopify.com" },
  { name: "Vercel", website: "https://vercel.com" },
  { name: "Datadog", website: "https://datadoghq.com" },
  { name: "Klarna", website: "https://klarna.com" },
] as const;

/* ------------------------------------------------------------------ hero -- */

function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b">
      <GridBackdrop />
      <div className="container-page relative pb-20 pt-16 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
            Built for people running a real job search
          </span>

          <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-6xl">
            Your entire job search,
            <br className="hidden sm:block" />{" "}
            <span className="relative whitespace-nowrap text-brand-accent">
              in one place.
              <Underline />
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Applications, interviews and follow-ups live together in a single workspace — so you
            always know what's still live, what's next, and what needs a nudge today.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-11 w-full px-7 text-sm sm:w-auto">
              <Link to="/auth">
                Start tracking — free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-11 w-full px-7 text-sm sm:w-auto"
            >
              <Link to="/dashboard">See the dashboard</Link>
            </Button>
          </div>

          <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            {["Free to start", "No credit card", "Private by default"].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-brand-accent" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <ProductPreview />
      </div>
    </section>
  );
}

/** Faint graph-paper wash behind the hero, faded out towards the fold. */
function GridBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 70% 55% at 50% 0%, #000 55%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 55% at 50% 0%, #000 55%, transparent 100%)",
        }}
      />
      <div
        className="absolute left-1/2 top-[-8rem] h-[22rem] w-[46rem] -translate-x-1/2 rounded-full opacity-[0.07] blur-3xl"
        style={{ background: "var(--brand)" }}
      />
    </div>
  );
}

/** Hand-drawn rule under the accented headline words. */
function Underline() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 300 12"
      preserveAspectRatio="none"
      className="absolute -bottom-1.5 left-0 h-2.5 w-full text-brand-accent"
    >
      <path
        d="M2 8.5C52 3.5 108 2.5 160 4.5c46 1.8 92 3.6 138 1.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.4"
      />
    </svg>
  );
}

/* --------------------------------------------------------- hero preview -- */

const kpis = [
  { label: "Active", value: "14" },
  { label: "Interviews", value: "3" },
  { label: "Offers", value: "1" },
  { label: "Due today", value: "2", accent: true },
];

/*
 * Three rows of a real-looking board. Each borrows a company from COMPANIES so
 * the preview renders the same live mark the app would, and each carries a
 * genuine `Status` rather than a label — the badge below is the product's own
 * statusColor, so the colour a visitor learns here is the colour they meet on
 * their first application.
 *
 * It used to have a private three-tone scale (solid / brand / muted) that
 * agreed with nothing: "Offer" was brand red on the homepage and green in the
 * app, so the one screen whose job is to teach the vocabulary taught the wrong
 * one.
 */
const pipeline = [
  {
    company: COMPANIES[0],
    role: "Senior Product Designer",
    status: "interviewing" as const,
    meta: "Round 2 · Thursday",
  },
  {
    company: COMPANIES[1],
    role: "Design Lead",
    status: "offer" as const,
    meta: "Respond by Friday",
    flagged: true,
  },
  {
    company: COMPANIES[3],
    role: "Product Designer",
    status: "applied" as const,
    meta: "Sent 6 days ago",
  },
];

/**
 * A representative view of the product, drawn in markup rather than shipped as
 * a screenshot so it stays sharp and follows the theme. The data is illustrative.
 */
function ProductPreview() {
  return (
    <div className="relative mx-auto mt-16 max-w-4xl sm:mt-20">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-[0_30px_70px_-30px_oklch(0_0_0/0.35)]">
        <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
          </span>
          <span className="ml-2 text-xs font-medium text-muted-foreground">Your pipeline</span>
        </div>

        <div className="grid grid-cols-2 divide-x divide-y border-b sm:grid-cols-4 sm:divide-y-0">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="px-5 py-4">
              <p className="text-[0.7rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {kpi.label}
              </p>
              <p
                className={`mt-1 text-2xl font-semibold tracking-tight ${
                  kpi.accent ? "text-brand-accent" : ""
                }`}
              >
                {kpi.value}
              </p>
            </div>
          ))}
        </div>

        <ul className="divide-y">
          {pipeline.map((row) => (
            <li key={row.company.name} className="relative flex items-center gap-4 px-5 py-4">
              {row.flagged && (
                <span className="absolute inset-y-0 left-0 w-[3px] bg-brand" aria-hidden="true" />
              )}
              <CompanyLogo company={row.company.name} website={row.company.website} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{row.company.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{row.role}</span>
              </span>
              <span className="hidden text-xs text-muted-foreground sm:block">{row.meta}</span>
              <Badge variant="outline" className={`${statusColor[row.status]} capitalize`}>
                {row.status}
              </Badge>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- logo band -- */

/**
 * The proof strip.
 *
 * Every other tracker's homepage puts a row of customer logos here and means
 * "these companies bought this". This one means the opposite, and the heading
 * has to carry that or the strip is a lie: these are the employers you are
 * chasing, and the marks are the ones your own board will draw the moment you
 * paste a careers URL into it.
 *
 * Which makes the strip an honest demo rather than decoration — it is the
 * logo pipeline running in public, on the same component and the same live
 * favicon lookup the application list uses. If a mark here falls back to a
 * monogram, that is exactly what it would do on your board too.
 *
 * No marquee. A scrolling strip would put motion directly under a hero that
 * already has a lot going on, and it makes the logos unreadable at the moment
 * you want them read. Ten marks fit a static grid at every width.
 */
function LogoBand() {
  return (
    <section aria-labelledby="companies-heading" className="border-b bg-muted/40">
      <div className="container-page py-14 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="companies-heading"
            className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-accent"
          >
            Your shortlist, not ours
          </h2>
          <p className="mt-3 text-lg font-medium tracking-tight sm:text-xl">
            Every company you apply to arrives with its own logo.
          </p>
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
            Paste the careers page URL and the mark resolves itself — so your board looks like the
            companies you're chasing, not a column of grey initials.
          </p>
        </div>

        <ul className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {COMPANIES.map((company) => (
            <li
              key={company.name}
              className="flex items-center gap-3 rounded-xl border bg-card px-3.5 py-3 transition-colors hover:border-foreground/20"
            >
              <CompanyLogo company={company.name} website={company.website} />
              <span className="truncate text-sm font-medium">{company.name}</span>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Company names and logos are the property of their respective owners, shown here as
          examples of roles you might track. No affiliation or endorsement is implied.
        </p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- features -- */

function Features() {
  return (
    <section id="features" className="scroll-mt-20 border-b bg-muted/40">
      <div className="container-page py-20 sm:py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-accent">
            One workspace
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            Everything the search needs. Nothing it doesn't.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            A spreadsheet tells you what you typed. This tells you where you stand.
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          <FeatureCard
            className="lg:col-span-2"
            icon={Layers}
            title="See the whole pipeline at a glance"
            body="Every role you've applied to, sorted by the stage it's actually in — applied, interviewing, offer, rejected, withdrawn. No stale tabs, no guessing."
            visual={<FunnelVisual />}
          />
          <FeatureCard
            id="follow-ups"
            icon={CalendarClock}
            title="Follow-ups that never slip"
            body="Attach tasks with due dates to any application. Overdue work surfaces first."
            visual={<TasksVisual />}
          />
          <FeatureCard
            id="insights"
            icon={LineChart}
            title="Momentum you can measure"
            body="Weekly volume, stage conversion and response times — so you can adjust while it still matters."
            visual={<BarsVisual />}
          />
          <FeatureCard
            icon={History}
            title="Every status change, remembered"
            body="A dated trail for each role, so you can see how long a stage really took."
            visual={<TimelineVisual />}
          />
          <FeatureCard
            icon={Lock}
            title="Private by default"
            body="Row-level security on every table. Your search is visible to you and nobody else."
            visual={<PrivacyVisual />}
          />
          <FeatureCard
            className="lg:col-span-3"
            layout="row"
            icon={FileUp}
            title="Already have a spreadsheet? Bring it."
            body="Import your existing tracker as CSV — company, position, status, date and notes. Download the template, drop the file in, and every row that doesn't parse is reported back to you instead of being silently dropped."
            visual={<ImportVisual />}
          />
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  id,
  className = "",
  layout = "stack",
  icon: Icon,
  title,
  body,
  visual,
}: {
  id?: string;
  className?: string;
  /** "row" puts the visual beside the copy from `lg` up — for full-width cards. */
  layout?: "stack" | "row";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  visual: React.ReactNode;
}) {
  if (layout === "row") {
    return (
      <article
        id={id}
        className={`grid scroll-mt-20 gap-6 rounded-xl border bg-card p-6 transition-colors hover:border-foreground/20 lg:grid-cols-2 lg:items-center lg:gap-10 lg:p-8 ${className}`}
      >
        <div>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border bg-background">
            <Icon className="h-4 w-4" />
          </span>
          <h3 className="mt-4 text-base font-semibold tracking-tight">{title}</h3>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">{body}</p>
        </div>
        <div>{visual}</div>
      </article>
    );
  }

  return (
    <article
      id={id}
      className={`group flex scroll-mt-20 flex-col rounded-xl border bg-card p-6 transition-colors hover:border-foreground/20 ${className}`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg border bg-background">
        <Icon className="h-4 w-4" />
      </span>
      <h3 className="mt-4 text-base font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-6 flex-1">{visual}</div>
    </article>
  );
}

/*
 * A miniature of the dashboard's "Stage reach" chart, and it has to be exactly
 * that: same three stages, same three fills, same value labels on the right.
 * It previously drew Applied and Interviewing in one black and Offer in brand
 * red, which is the colour this product uses for a rejection.
 */
const funnel = [
  { label: "Applied", count: 14, width: "100%", status: "applied" },
  { label: "Interviewing", count: 3, width: "42%", status: "interviewing" },
  { label: "Offer", count: 1, width: "18%", status: "offer" },
] as const;

function FunnelVisual() {
  return (
    <div className="flex h-full flex-col justify-end gap-3">
      {funnel.map((stage) => (
        <div key={stage.label} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-xs text-muted-foreground">{stage.label}</span>
          <span className="h-7 flex-1 overflow-hidden rounded-md bg-muted">
            <span
              className="block h-full rounded-md"
              style={{ width: stage.width, background: statusFill[stage.status] }}
            />
          </span>
          <span className="w-6 shrink-0 text-right text-xs font-medium tabular-nums">
            {stage.count}
          </span>
        </div>
      ))}
    </div>
  );
}

const tasks = [
  { label: "Send portfolio to Stripe", done: true },
  { label: "Thank-you note — Figma", done: false, overdue: true },
  { label: "Prep system design round", done: false },
];

function TasksVisual() {
  return (
    <ul className="flex h-full flex-col justify-end gap-2.5">
      {tasks.map((task) => (
        <li key={task.label} className="flex items-center gap-2.5 text-xs">
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
              task.done ? "border-foreground bg-foreground" : "bg-background"
            } ${task.overdue ? "border-[var(--status-rejected)]" : ""}`}
            aria-hidden="true"
          >
            {task.done && <Check className="h-3 w-3 text-background" />}
          </span>
          <span className={task.done ? "text-muted-foreground line-through" : ""}>
            {task.label}
          </span>
          {/* The overdue pill on the tasks page, to the token. */}
          {task.overdue && (
            <span className="ml-auto shrink-0 rounded-full bg-[var(--status-rejected-soft)] px-2 py-0.5 text-[0.65rem] font-medium text-[var(--status-rejected-text)]">
              Overdue
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

const weeks = [38, 55, 30, 72, 48, 90, 64];

/*
 * Volume, so ink — the same reasoning as the dashboard's per-week chart, where
 * a bar counts applications rather than outcomes. The busiest week is picked
 * out in gold rather than red: it is the week worth noticing, not a warning.
 */
function BarsVisual() {
  const peak = Math.max(...weeks);
  return (
    <div className="flex h-24 items-end gap-1.5">
      {weeks.map((height, i) => (
        <span
          key={i}
          className="flex-1 rounded-sm"
          style={{
            height: `${height}%`,
            background: height === peak ? statusFill.interviewing : statusFill.applied,
          }}
        />
      ))}
    </div>
  );
}

/* Each dot wears the status it records — the trail reads as the same pipeline
 * the badges do, newest first. */
const timeline = [
  { label: "Offer", date: "Jul 24", status: "offer" },
  { label: "Interviewing", date: "Jul 09", status: "interviewing" },
  { label: "Applied", date: "Jun 30", status: "applied" },
] as const;

function TimelineVisual() {
  return (
    <ol className="relative flex h-full flex-col justify-end gap-3 border-l pl-4">
      {timeline.map((entry) => (
        <li key={entry.label} className="relative text-xs">
          <span
            className="absolute -left-[1.31rem] top-1 h-2 w-2 rounded-full ring-2 ring-card"
            style={{ background: statusFill[entry.status] }}
            aria-hidden="true"
          />
          <span className="font-medium">{entry.label}</span>
          <span className="ml-2 text-muted-foreground">{entry.date}</span>
        </li>
      ))}
    </ol>
  );
}

const csvPreview = [
  { cells: ["company", "position", "status"], head: true },
  { cells: ["Stripe", "Sr. Product Designer", "interviewing"] },
  { cells: ["Figma", "Design Lead", "offer"] },
  { cells: ["Linear", "Product Designer", "applied"] },
];

function ImportVisual() {
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2">
        <FileUp className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="font-mono text-[0.7rem] text-muted-foreground">applications.csv</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[22rem] text-left font-mono text-[0.7rem]">
          <tbody className="divide-y">
            {csvPreview.map((row) => (
              <tr key={row.cells[0]} className={row.head ? "bg-muted/30" : ""}>
                {row.cells.map((cell) => (
                  <td
                    key={cell}
                    className={`px-3 py-1.5 ${
                      row.head ? "font-medium text-muted-foreground" : "whitespace-nowrap"
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PrivacyVisual() {
  return (
    <div className="flex h-full items-end">
      <div className="w-full rounded-lg border border-dashed bg-muted/60 px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-medium">
          <Lock className="h-3.5 w-3.5 text-brand-accent" aria-hidden="true" />
          Visible to you only
        </div>
        <div className="mt-2 space-y-1.5" aria-hidden="true">
          <span className="block h-1.5 w-full rounded-full bg-border" />
          <span className="block h-1.5 w-3/5 rounded-full bg-border" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ closing cta -- */

function ClosingCta() {
  return (
    <section className="relative isolate overflow-hidden bg-foreground text-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-25 blur-3xl"
        style={{ background: "var(--brand)" }}
      />
      <div className="container-page relative py-20 text-center sm:py-24">
        <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          Stop rebuilding the spreadsheet. Start tracking the search.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-background/70 sm:text-base">
          Add your first application in under a minute and see the whole picture from day one.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="h-11 w-full bg-background px-7 text-sm text-foreground hover:bg-background/90 sm:w-auto"
          >
            <Link to="/auth">
              Create your workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Link
            to="/applications"
            className="text-sm font-medium text-background/70 underline-offset-4 transition-colors hover:text-background hover:underline"
          >
            Browse applications
          </Link>
        </div>
      </div>
    </section>
  );
}
