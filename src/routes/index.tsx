import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarClock,
  CalendarSync,
  Check,
  FileUp,
  History,
  Layers,
  LineChart,
  Lock,
  Scissors,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";
import { CompanyLogo } from "@/components/CompanyLogo";
import { Badge } from "@/components/ui/badge";
import { statusColor, statusFill } from "@/lib/status";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Job Tracker — Track every application, land the job" },
      {
        name: "description",
        content:
          "Clip job ads with a browser extension, keep every application, interview and follow-up in one workspace, and see exactly what's moving you closer to an offer.",
      },
      { property: "og:title", content: "Job Tracker — Track every application, land the job" },
      {
        property: "og:description",
        content:
          "Clip job ads with a browser extension, keep every application, interview and follow-up in one workspace, and see exactly what's moving you closer to an offer.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main>
      <Hero />
      <CaptureSection />
      <FollowThroughSection />
      <StandingSection />
      <OwnershipSection />
      <LogoBand />
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
            Built for people going after the job they want
          </span>

          <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-6xl">
            Track every application.
            <br className="hidden sm:block" />{" "}
            <span className="relative whitespace-nowrap text-brand-accent">
              Land the job.
              <Underline />
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Clip a posting from LinkedIn or Greenhouse in one click, keep every interview and
            follow-up in one workspace, and let due tasks land on your calendar automatically — so
            every role keeps moving towards an offer.
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
            Your shortlist
          </h2>
          <p className="mt-3 text-lg font-medium tracking-tight sm:text-xl">
            Every company you apply to arrives with its own logo.
          </p>
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
            Paste the careers page URL and the logo resolves itself, so your board shows the
            companies you're going after instead of a column of grey initials.
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

/**
 * One beat of the product story.
 *
 * The features used to be a single section with seven cards in it, which read
 * as a specification rather than an argument. Each beat now carries its own
 * claim and two or three cards at most, in the order the work actually
 * happens: capture it, stay on top of it, see where it got you, keep it yours.
 *
 * The headings are deliberately a size down from the hero's — four of them at
 * `text-4xl` would each compete with the one line the page is actually built
 * around.
 */
function StorySection({
  id,
  eyebrow,
  title,
  lede,
  muted = false,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  lede: string;
  /** Alternated down the page so consecutive beats read as separate sections. */
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`scroll-mt-20 border-b ${muted ? "bg-muted/40" : ""}`}>
      <div className="container-page py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-accent">
            {eyebrow}
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{title}</h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">{lede}</p>
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">{children}</div>
      </div>
    </section>
  );
}

/* The nav's "Features" link lands here, on the first beat of the story. */
function CaptureSection() {
  return (
    <StorySection
      id="features"
      eyebrow="Capture"
      title="Capture the whole posting in one click."
      lede="Salary, requirements and the full text go into your tracker while you're still reading the ad, so you can compare roles on the details that decide them."
    >
      <FeatureCard
        className="lg:col-span-3"
        layout="row"
        icon={Scissors}
        title="Clip a posting the moment you find it"
        body="A browser extension reads the job ad already open in your tab — LinkedIn, Greenhouse, Lever, Ashby, Workday, or almost anything else — and saves it in one click. It reads only what's already on your screen, so a site redesign never breaks the capture."
        visual={<ClipVisual />}
      />
    </StorySection>
  );
}

function FollowThroughSection() {
  return (
    <StorySection
      id="follow-ups"
      muted
      eyebrow="Follow through"
      title="Stay in front of every employer, from applying to offer."
      lede="Every open role carries its next move and a date, and today's move shows up where you already look."
    >
      <FeatureCard
        className="lg:col-span-2"
        icon={CalendarSync}
        title="Every follow-up, already on your calendar"
        body="Connect Google Calendar once and open, dated tasks push to it automatically — create, reschedule or complete one and the event follows. Outlook and Apple Calendar work too, through a private iCal feed."
        visual={<CalendarSyncVisual />}
      />
      <FeatureCard
        icon={CalendarClock}
        title="Today's follow-ups, first in line"
        body="Attach dated tasks to any application. What's due today rises to the top of the list, in time for you to act on it."
        visual={<TasksVisual />}
      />
    </StorySection>
  );
}

function StandingSection() {
  return (
    <StorySection
      id="insights"
      eyebrow="Where you stand"
      title="See exactly what's moving you closer to an offer."
      lede="Where each role sits today, how long it took to get there, and which weeks are earning you interviews."
    >
      <FeatureCard
        icon={Layers}
        title="See the whole pipeline at a glance"
        body="Every role sorted by the stage it's actually in — wishlist, applied, interviewing, offer — and drag a card to move it on. One board, always current."
        visual={<FunnelVisual />}
      />
      <FeatureCard
        icon={LineChart}
        title="Momentum you can measure"
        body="Weekly volume, stage conversion and response times, so you can adjust your approach while it still counts."
        visual={<BarsVisual />}
      />
      <FeatureCard
        icon={History}
        title="Every status change, remembered"
        body="A dated trail for each role, so you can see how long a stage really took."
        visual={<TimelineVisual />}
      />
    </StorySection>
  );
}

function OwnershipSection() {
  return (
    <StorySection
      muted
      eyebrow="Your data"
      title="Bring what you have. Keep what's yours."
      lede="Start from the spreadsheet you already keep, and know the whole search stays visible to you alone."
    >
      <FeatureCard
        className="lg:col-span-2"
        icon={FileUp}
        title="Bring the spreadsheet you already keep"
        body="Import your existing tracker as CSV — company, position, status, date and notes. Download the template, drop the file in, and every row that doesn't parse is reported back to you, line by line."
        visual={<ImportVisual />}
      />
      <FeatureCard
        icon={Lock}
        title="Private by default"
        body="Row-level security on every table. Your search is visible to you and nobody else."
        visual={<PrivacyVisual />}
      />
    </StorySection>
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

/**
 * A browser window with the extension's popup overlaid, so the card reads as
 * "captured from a real page" rather than a bare data table.
 */
function ClipVisual() {
  const fields: [string, string][] = [
    ["Company", "Stripe"],
    ["Role", "Staff Engineer"],
    ["Salary", "€95k–130k"],
  ];
  return (
    <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
      <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2">
        <span className="flex shrink-0 gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-border" />
        </span>
        <span className="ml-1.5 min-w-0 flex-1 truncate rounded-md bg-background px-2.5 py-1 font-mono text-[0.65rem] text-muted-foreground ring-1 ring-border">
          linkedin.com/jobs/view/4213558042
        </span>
      </div>
      {/* min-height so the absolutely-positioned popup always clears the bottom
          edge — it used to get cut off by the wrapper's overflow-hidden. */}
      <div className="relative min-h-[220px] bg-muted/30 px-4 py-6 sm:min-h-[240px] sm:py-8">
        <div className="max-w-[60%] space-y-2 opacity-40" aria-hidden="true">
          <div className="h-2.5 w-4/5 rounded bg-border" />
          <div className="h-2 w-3/5 rounded bg-border" />
          <div className="h-2 w-full rounded bg-border" />
          <div className="h-2 w-2/3 rounded bg-border" />
          <div className="h-2 w-4/5 rounded bg-border" />
        </div>
        <div className="absolute right-4 top-4 w-48 overflow-hidden rounded-lg border bg-card shadow-lg sm:right-6 sm:top-6 sm:w-52">
          <div className="flex items-center gap-1.5 border-b bg-muted/50 px-2.5 py-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-foreground">
              <Scissors className="h-3 w-3 text-background" aria-hidden="true" />
            </span>
            <span className="truncate text-[0.65rem] font-medium">Clip to Job Tracker</span>
          </div>
          <div className="space-y-1 px-2.5 py-2 text-[0.65rem]">
            {fields.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-2">
                <span className="shrink-0 text-muted-foreground">{label}</span>
                <span className="truncate font-medium">{value}</span>
              </div>
            ))}
          </div>
          <div className="border-t px-2.5 py-2">
            <span className="block rounded-full bg-[var(--status-offer-soft)] px-2 py-1 text-center text-[0.65rem] font-medium text-[var(--status-offer-text)]">
              Clipped
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const week = [
  { day: "M", date: 9 },
  { day: "T", date: 10 },
  { day: "W", date: 11 },
  { day: "T", date: 12 },
  { day: "F", date: 13 },
  { day: "S", date: 14 },
  { day: "S", date: 15 },
] as const;

/** A mocked week view, so the pushed event reads as "on the calendar" rather than a lone card. */
function CalendarSyncVisual() {
  const todayIndex = 3;
  return (
    <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
      <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2">
        <CalendarSync className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="text-xs font-medium">Google Calendar</span>
        <span className="ml-auto shrink-0 rounded-full bg-[var(--status-offer-soft)] px-2 py-0.5 text-[0.65rem] font-medium text-[var(--status-offer-text)]">
          Connected
        </span>
      </div>
      <div className="px-4 pt-4">
        <div className="grid grid-cols-7 gap-1 text-center text-[0.65rem] font-medium text-muted-foreground">
          {week.map((w, i) => (
            <span key={i}>{w.day}</span>
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-7 gap-1 text-center text-xs">
          {week.map((w, i) => (
            <span
              key={w.date}
              className={`relative flex h-7 items-center justify-center rounded-full ${
                i === todayIndex ? "bg-foreground font-medium text-background" : ""
              }`}
            >
              {w.date}
              {i === todayIndex && (
                <span
                  className="absolute -bottom-1.5 h-1 w-1 rounded-full bg-[var(--status-interviewing)]"
                  aria-hidden="true"
                />
              )}
            </span>
          ))}
        </div>
      </div>
      {/* Thursday is the middle of seven columns, so a caret at dead centre points
          at the highlighted day: day → dot → caret → the event it pushed. */}
      <div className="relative px-4 pb-4 pt-3">
        <span
          className="absolute left-1/2 top-[0.45rem] h-2 w-2 -translate-x-1/2 rotate-45 bg-[var(--status-interviewing-soft)]"
          aria-hidden="true"
        />
        <div className="rounded-md border-l-4 border-[var(--status-interviewing)] bg-[var(--status-interviewing-soft)] px-3 py-2 text-xs">
          <p className="font-medium">Interview — Figma</p>
          <p className="text-muted-foreground">Thu, 2:00–2:45 PM</p>
        </div>
      </div>
    </div>
  );
}

/*
 * The queue this section is promising, so it has to *be* that promise: the
 * nearest task is due today and highlighted, nothing is overdue. An earlier
 * version showed a red "Overdue" pill directly under a heading that reads
 * "nothing slips" — the visual argued against the claim beside it.
 *
 * Today's row wears the interviewing tint rather than a red one: this is the
 * thing to do next, not a thing already missed. It's the same fill the pushed
 * calendar event carries in the card beside it, so the two read as one story.
 */
const followUps = [
  { label: "Send portfolio", role: "Stripe · Staff Engineer", when: "Done", done: true },
  { label: "Thank-you note", role: "Figma · Design Lead", when: "Today", due: true },
  { label: "Prep system design round", role: "Linear · Product Designer", when: "Wed" },
  { label: "Ask about relocation", role: "Vercel · Eng Manager", when: "Next week" },
];

function TasksVisual() {
  return (
    <ul className="flex h-full flex-col justify-center gap-1.5">
      {followUps.map((task) => (
        <li
          key={task.label}
          className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs ${
            task.due
              ? "bg-[var(--status-interviewing-soft)] ring-1 ring-inset ring-[var(--status-interviewing)]/25"
              : ""
          }`}
        >
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
              task.done ? "border-foreground bg-foreground" : "border-input bg-background"
            }`}
            aria-hidden="true"
          >
            {task.done && <Check className="h-3 w-3 text-background" />}
          </span>
          <span className="min-w-0 flex-1">
            <span
              className={`block truncate font-medium ${
                task.done ? "text-muted-foreground line-through" : ""
              }`}
            >
              {task.label}
            </span>
            <span className="block truncate text-[0.65rem] text-muted-foreground">{task.role}</span>
          </span>
          <span
            className={`shrink-0 text-[0.65rem] font-medium ${
              task.due ? "text-[var(--status-interviewing-text)]" : "text-muted-foreground"
            }`}
          >
            {task.when}
          </span>
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
          Every offer starts with one tracked application.
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
              Create your free workspace
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
