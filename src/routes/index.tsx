import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  CalendarSync,
  Check,
  FileUp,
  History,
  Layers,
  LineChart,
  Globe2,
  Lock,
  Pause,
  Play,
  Scissors,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";
import { CompanyLogo } from "@/components/CompanyLogo";
import { Badge } from "@/components/ui/badge";
import { statusColor, statusFill, type Status } from "@/lib/status";
import {
  WORKDAY,
  describeOverlap,
  formatHour,
  formatOffset,
  offsetBetween,
  timeInZone,
  workdayOverlap,
} from "@/lib/time-zone";
import {
  CountUp,
  Reveal,
  useArmed,
  useInView,
  useLoop,
  useReducedMotion,
  useScrollProgress,
  useTilt,
  useTypewriter,
} from "@/components/home/motion";

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

/*
 * The landing page is the one screen that has to argue for the product before
 * anyone has any data in it, so it argues by running the product.
 *
 * Nothing on this page is a screenshot or a video file. Every panel is the
 * real markup, the real status tokens and the real logo pipeline, animated
 * with a scripted sequence of states — which means the page cannot drift from
 * the app the way a captured image does, and a broken component shows up here
 * first. It also means the whole thing is a few kilobytes of CSS rather than a
 * hero video, so the fold paints on a phone on mobile data.
 *
 * The palette is untouched: ink, gold, green, red, grey, with red still spent
 * on emphasis rather than decoration. Motion is the only new material.
 *
 * Every animated class on the page is gated twice — behind
 * `prefers-reduced-motion: no-preference` in CSS, and behind a client-side
 * arm in JS (see components/home/motion.tsx). The finished layout is what the
 * server renders. Motion only ever borrows it.
 */
function Index() {
  return (
    <main>
      <ScrollRail />
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

/* ------------------------------------------------------- reading progress -- */

/**
 * A hairline at the very top that fills as the page is read.
 *
 * It sits above the sticky header rather than inside it, so it belongs to the
 * document rather than to the nav, and it is the one place on this page where
 * brand red is used without carrying a status — it is the page's own progress,
 * which is the definition of emphasis.
 */
function ScrollRail() {
  const progress = useScrollProgress();

  return (
    <div aria-hidden="true" className="fixed inset-x-0 top-0 z-50 h-[2px]">
      <div
        className="scroll-rail h-full bg-brand"
        style={{ "--progress": progress } as React.CSSProperties}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ hero -- */

function Hero() {
  const armed = useArmed();
  const [ref, inView] = useInView<HTMLDivElement>();
  const lit = !armed || inView;

  return (
    <section className="relative isolate overflow-hidden border-b">
      <HeroBackdrop />
      <div ref={ref} className="container-page relative pb-20 pt-16 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal variant="scale">
            <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
              Built for people going after the job they want
            </span>
          </Reveal>

          {/*
           * Two bands, each clipping a line that rises out of it. The type is
           * set a size larger than it used to be: this is the only sentence on
           * the page that has to be read from across the room.
           */}
          <h1 className="mt-6 text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-7xl">
            <span
              className={`block overflow-hidden ${armed ? "line-rise" : ""} ${lit ? "reveal-in" : ""}`}
            >
              <span>Track every application.</span>
            </span>
            <span
              className={`block overflow-hidden pb-3 ${armed ? "line-rise" : ""} ${lit ? "reveal-in" : ""}`}
            >
              <span style={armed ? { transitionDelay: "110ms" } : undefined}>
                <span className="relative whitespace-nowrap text-brand-accent">
                  Land the job.
                  <Underline lit={lit} armed={armed} />
                </span>
              </span>
            </span>
          </h1>

          <Reveal delay={220}>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Clip a posting from LinkedIn or Greenhouse in one click, keep every interview and
              follow-up in one workspace, and let due tasks land on your calendar automatically — so
              every role keeps moving towards an offer.
            </p>
          </Reveal>

          <Reveal delay={320}>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="sheen h-11 w-full px-7 text-sm sm:w-auto">
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
          </Reveal>

          <Reveal delay={400}>
            <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              {["Free to start", "No credit card", "Private by default"].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-brand-accent" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <LiveBoard />
      </div>
    </section>
  );
}

/**
 * Behind the hero: graph paper, two slow red fields, and a band of light that
 * travels down the grid every eight seconds.
 *
 * The red is at 6–8% opacity and heavily blurred, which is as much as an
 * otherwise chroma-0 page can take before the wash starts reading as a second
 * surface colour. The sweep is what turns the grid from a texture into a
 * surface — it is the only thing on the fold that moves on its own.
 */
function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
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
        className="grid-sweep absolute inset-x-0 top-0 h-40"
        style={{
          background:
            "linear-gradient(to bottom, transparent, color-mix(in oklch, var(--brand) 9%, transparent), transparent)",
          maskImage: "radial-gradient(ellipse 60% 100% at 50% 50%, #000 30%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 100% at 50% 50%, #000 30%, transparent 100%)",
        }}
      />
      <div
        className="aurora-a absolute left-1/2 top-[-10rem] h-[24rem] w-[46rem] -translate-x-1/2 rounded-full opacity-[0.08] blur-3xl"
        style={{ background: "var(--brand)" }}
      />
      <div
        className="aurora-b absolute left-[62%] top-[6rem] h-[20rem] w-[30rem] rounded-full opacity-[0.06] blur-3xl"
        style={{ background: "var(--brand)" }}
      />
    </div>
  );
}

/** Hand-drawn rule under the accented headline words — drawn, not faded in. */
function Underline({ lit, armed }: { lit: boolean; armed: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 300 12"
      preserveAspectRatio="none"
      className={`absolute -bottom-1.5 left-0 h-2.5 w-full text-brand-accent ${
        armed ? "underline-draw" : ""
      } ${lit ? "reveal-in" : ""}`}
    >
      <path
        d="M2 8.5C52 3.5 108 2.5 160 4.5c46 1.8 92 3.6 138 1.4"
        pathLength={1}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.4"
      />
    </svg>
  );
}

/* --------------------------------------------------------- the live board -- */

/*
 * The scripted demo under the hero.
 *
 * Five beats, in the order the product is actually used: you find a posting,
 * you clip it, it lands on your board, a company replies, an offer arrives.
 * Each beat is a *state* of the same board — no beat draws a different panel —
 * so what the visitor learns here is the screen they will be looking at ten
 * minutes from now, including which colour means what.
 *
 * The rail underneath is a real control, not a progress indicator: a pause
 * button, then five segments that jump to a beat and hold it there. Resting a
 * pointer inside the panel pauses it too, and so does moving focus into it.
 * For a reduced-motion viewer the loop never starts — the board rests on beat
 * 0, complete and readable, and the rail is the only way through it. All of
 * which is one idea: a demo you cannot stop is a demo you cannot read.
 */
const BOARD_BEATS = [2400, 2000, 2100, 2300, 2600] as const;

const BOARD_CAPTIONS = [
  "Your board this morning",
  "Clipping the posting you're reading",
  "Notion added — salary and requirements included",
  "Stripe moved to interviewing",
  "Figma sent an offer",
] as const;

type BoardRow = {
  company: (typeof COMPANIES)[number];
  role: string;
  status: Status;
  meta: string;
};

/** Beat-dependent state for the three rows that were already on the board. */
function boardRows(beat: number): BoardRow[] {
  return [
    {
      company: COMPANIES[0],
      role: "Senior Product Designer",
      status: beat >= 3 ? "interviewing" : "applied",
      meta: beat >= 3 ? "Round 1 · Tuesday" : "Sent 6 days ago",
    },
    {
      company: COMPANIES[1],
      role: "Design Lead",
      status: beat >= 4 ? "offer" : "interviewing",
      meta: beat >= 4 ? "Respond by Friday" : "Round 2 · Thursday",
    },
    {
      company: COMPANIES[3],
      role: "Product Designer",
      status: "applied",
      meta: "Sent 12 days ago",
    },
  ];
}

/* The counters move because the board moved. Every figure here is the arithmetic
 * of the rows above it — an offer arriving takes one off Interviews. */
function boardKpis(beat: number) {
  return [
    { label: "Active", value: beat >= 2 ? 15 : 14 },
    { label: "Interviews", value: beat >= 4 ? 4 : beat >= 3 ? 5 : 4 },
    { label: "Offers", value: beat >= 4 ? 2 : 1 },
    { label: "Due today", value: 2, accent: true },
  ];
}

function LiveBoard() {
  const reduced = useReducedMotion();
  const [viewRef, inView] = useInView<HTMLDivElement>(false, 0.3);
  /*
   * Two separate reasons the demo can be still, because they have different
   * lifetimes. `hovering` is momentary — the pointer is resting on the panel,
   * or focus is inside it, and the visitor is reading a frame. `stopped` is a
   * decision: they pressed pause, or picked a beat off the rail, and the loop
   * stays put until they say otherwise.
   *
   * The explicit control is not optional decoration. This panel updates itself
   * for far longer than five seconds, so it owes the reader a way to stop it
   * that does not depend on owning a mouse (WCAG 2.2.2). Hover alone is not
   * that mechanism; a button is.
   */
  const [hovering, setHovering] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [beat, setBeat] = useLoop(BOARD_BEATS, inView && !hovering && !stopped && !reduced);
  const tilt = useTilt(inView && !reduced);

  const rows = boardRows(beat);
  const kpis = boardKpis(beat);
  const newRow = beat >= 2;
  /* Which existing row just changed, so the flash lands on that row only. */
  const changed = beat === 3 ? 0 : beat === 4 ? 1 : -1;

  return (
    <div ref={viewRef} className="tilt-scene relative mx-auto mt-16 max-w-4xl sm:mt-20">
      <Reveal variant="scale">
        <div
          ref={tilt.ref}
          onPointerMove={tilt.onPointerMove}
          onPointerLeave={() => {
            tilt.onPointerLeave();
            setHovering(false);
          }}
          onPointerEnter={() => setHovering(true)}
          onFocusCapture={() => setHovering(true)}
          onBlurCapture={() => setHovering(false)}
          className={`tilt overflow-hidden rounded-2xl border bg-card shadow-[0_40px_90px_-40px_oklch(0_0_0/0.45)] ${
            tilt.tracking ? "is-tracking" : ""
          }`}
        >
          {/* Browser chrome. The URL is the one the clip beat reads from. */}
          <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
            <span className="flex gap-1.5" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-border" />
              <span className="h-2.5 w-2.5 rounded-full bg-border" />
              <span className="h-2.5 w-2.5 rounded-full bg-border" />
            </span>
            <span className="ml-2 text-xs font-medium text-muted-foreground">Your pipeline</span>
            <span className="ml-auto flex items-center gap-1.5 text-[0.65rem] font-medium text-muted-foreground">
              <span
                className={`h-1.5 w-1.5 rounded-full ${beat >= 1 && beat <= 2 ? "pulse-dot" : ""}`}
                style={{ background: "var(--status-offer)" }}
                aria-hidden="true"
              />
              Live
            </span>
          </div>

          <div className="grid grid-cols-2 divide-x divide-y border-b sm:grid-cols-4 sm:divide-y-0">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="px-5 py-4">
                <p className="text-[0.7rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {kpi.label}
                </p>
                <p
                  className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${
                    kpi.accent ? "text-brand-accent" : ""
                  }`}
                >
                  <CountUp value={kpi.value} />
                </p>
              </div>
            ))}
          </div>

          <div className="relative">
            {/* The clipped posting, travelling from the chrome into the list. */}
            {beat === 1 && !reduced && (
              <div
                key={`clip-${beat}`}
                aria-hidden="true"
                className="chip-fly pointer-events-none absolute right-4 top-2 z-10 flex items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-lg"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-foreground">
                  <Scissors className="h-3 w-3 text-background" />
                </span>
                <span className="font-mono text-[0.65rem] text-muted-foreground">
                  notion.so/careers
                </span>
              </div>
            )}

            <ul className="divide-y">
              {/* The arriving row opens a slot for itself rather than popping
                  in, and closes it again when the loop restarts — so the reset
                  is part of the animation instead of a flicker. */}
              <li
                className={`overflow-hidden transition-all duration-500 ease-[cubic-bezier(.16,1,.3,1)] ${
                  newRow ? "max-h-24 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <BoardRowBody
                  row={{
                    company: COMPANIES[2],
                    role: "Product Engineer",
                    status: "applied",
                    meta: "Clipped just now",
                  }}
                  fresh
                />
              </li>

              {rows.map((row, index) => (
                <li key={row.company.name} className="relative">
                  {index === changed && !reduced && (
                    <span
                      key={`flash-${beat}`}
                      aria-hidden="true"
                      className="row-flash pointer-events-none absolute inset-1 rounded-md"
                      style={{ color: statusFill[row.status] }}
                    />
                  )}
                  <BoardRowBody row={row} />
                </li>
              ))}
            </ul>
          </div>

          {/* Narration. One line, replaced on each beat, so the visitor is told
              what they are watching instead of having to infer it. */}
          <div className="flex flex-col gap-3 border-t bg-muted/40 px-4 py-3 sm:flex-row sm:items-center">
            <p key={beat} className="flex-1 text-xs text-muted-foreground">
              <span className={reduced ? "" : "badge-swap inline-block"}>
                {BOARD_CAPTIONS[beat]}
              </span>
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStopped((was) => !was)}
                aria-label={stopped ? "Play the demo" : "Pause the demo"}
                className="flex h-6 w-6 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
              >
                {stopped ? (
                  <Play className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <Pause className="h-3 w-3" aria-hidden="true" />
                )}
              </button>
              <div className="flex items-center gap-1.5" role="group" aria-label="Demo steps">
                {BOARD_CAPTIONS.map((caption, index) => (
                  <button
                    key={caption}
                    type="button"
                    /* Picking a beat is taking the wheel, so it stops the loop
                       too — otherwise the frame you chose is gone in two
                       seconds and the rail reads as decoration. */
                    onClick={() => {
                      setBeat(index);
                      setStopped(true);
                    }}
                    aria-label={caption}
                    aria-current={index === beat}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      index === beat ? "w-7 bg-brand" : "w-3 bg-border hover:bg-foreground/30"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

function BoardRowBody({ row, fresh = false }: { row: BoardRow; fresh?: boolean }) {
  return (
    <div className="relative flex items-center gap-4 px-5 py-4">
      {fresh && <span className="absolute inset-y-0 left-0 w-[3px] bg-brand" aria-hidden="true" />}
      <CompanyLogo company={row.company.name} website={row.company.website} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{row.company.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{row.role}</span>
      </span>
      <span className="hidden text-xs text-muted-foreground sm:block">{row.meta}</span>
      {/* Keyed on the status so a change remounts the badge and replays the
          swap — the colour change is the news, and it should be seen landing. */}
      <Badge
        key={row.status}
        variant="outline"
        className={`badge-swap ${statusColor[row.status]} capitalize`}
      >
        {row.status}
      </Badge>
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
 * Still no marquee, for the reason it never had one: a scrolling strip makes
 * logos unreadable at the moment you want them read. The motion that was added
 * instead is the resolver itself — a URL types into a field and the mark
 * appears — which is the claim the paragraph makes, performed rather than
 * asserted. The ten-mark grid below it stays still.
 */
function LogoBand() {
  return (
    <section aria-labelledby="companies-heading" className="border-b bg-muted/40">
      <div className="container-page py-14 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
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
          </Reveal>
        </div>

        <Reveal delay={120}>
          <Resolver />
        </Reveal>

        <ul className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {COMPANIES.map((company, index) => (
            <Reveal key={company.name} variant="scale" delay={index * 45} className="min-w-0">
              <li className="logo-tile flex items-center gap-3 rounded-xl border bg-card px-3.5 py-3 hover:border-foreground/20 hover:shadow-md">
                <CompanyLogo company={company.name} website={company.website} />
                <span className="truncate text-sm font-medium">{company.name}</span>
              </li>
            </Reveal>
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

/*
 * URL in, mark out. Four companies, cycled.
 *
 * The favicon it draws is fetched at that moment by the same CompanyLogo the
 * board uses, so this is not a mock of the resolver — it is the resolver.
 */
const RESOLVER_COMPANIES = [COMPANIES[2], COMPANIES[5], COMPANIES[6], COMPANIES[8]] as const;
const RESOLVER_BEATS = [3600, 3600, 3600, 3600] as const;

function Resolver() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>(false, 0.4);
  const [beat] = useLoop(RESOLVER_BEATS, inView && !reduced);
  const company = RESOLVER_COMPANIES[beat];
  const url = company.website.replace("https://", "");
  const { typed, done } = useTypewriter(url, inView && !reduced);

  return (
    <div ref={ref} className="mx-auto mt-9 flex max-w-md items-center gap-3">
      <div className="flex h-11 min-w-0 flex-1 items-center rounded-lg border bg-background px-3.5 shadow-sm">
        <span className="truncate font-mono text-xs text-muted-foreground">
          {typed}
          {!done && !reduced && (
            <span className="caret ml-px inline-block h-3 w-px align-middle bg-foreground" />
          )}
        </span>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center transition-all duration-500 ${
          done ? "scale-100 opacity-100" : "scale-75 opacity-0"
        }`}
      >
        {/* Keyed on the company so each mark is fetched fresh, exactly as a
            newly-saved application would fetch it. */}
        <CompanyLogo
          key={company.name}
          company={company.name}
          website={company.website}
          size="md"
        />
      </div>
    </div>
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
 *
 * The oversized figure in the corner is the one purely typographic flourish on
 * the page. It is set in the page's own ink at 4% and is `aria-hidden`: it
 * gives four otherwise identical sections a sense of sequence at a glance,
 * which is what a reader skimming for "how far in am I" is looking for.
 */
function StorySection({
  id,
  step,
  eyebrow,
  title,
  lede,
  muted = false,
  children,
}: {
  id?: string;
  step: string;
  eyebrow: string;
  title: string;
  lede: string;
  /** Alternated down the page so consecutive beats read as separate sections. */
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`relative isolate scroll-mt-20 overflow-hidden border-b ${muted ? "bg-muted/40" : ""}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-6 right-2 select-none text-[9rem] font-semibold leading-none tracking-tighter text-foreground/[0.04] sm:right-8 sm:text-[13rem]"
      >
        {step}
      </span>

      <div className="container-page relative py-16 sm:py-20">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-accent">
            {eyebrow}
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{title}</h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">{lede}</p>
        </Reveal>
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
      step="01"
      eyebrow="Capture"
      title="Capture the whole posting in one click."
      lede="Salary, requirements and the full text go into your tracker while you're still reading the ad, and the city on it becomes a working day in your own hours — so you can compare roles on the details that decide them."
    >
      <FeatureCard
        className="lg:col-span-2"
        icon={Scissors}
        title="Clip a posting the moment you find it"
        body="A browser extension reads the job ad already open in your tab — LinkedIn, Greenhouse, Lever, Ashby, Workday, or almost anything else — and saves it in one click. It reads only what's already on your screen, so a site redesign never breaks the capture."
        visual={<ClipVisual />}
      />
      <FeatureCard
        delay={90}
        icon={Globe2}
        title="See the working day you'd share"
        body="The city on the posting becomes hours you can weigh: the time there now, the difference, and the window your day and theirs actually meet. Set the zone by hand when a remote role still has to cover one office."
        visual={<TimeZoneVisual />}
      />
    </StorySection>
  );
}

function FollowThroughSection() {
  return (
    <StorySection
      id="follow-ups"
      step="02"
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
        delay={90}
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
      step="03"
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
        delay={90}
        icon={LineChart}
        title="Momentum you can measure"
        body="Weekly volume, stage conversion and response times, so you can adjust your approach while it still counts."
        visual={<BarsVisual />}
      />
      <FeatureCard
        delay={180}
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
      step="04"
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
        delay={90}
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
  delay = 0,
  layout = "stack",
  icon: Icon,
  title,
  body,
  visual,
}: {
  id?: string;
  className?: string;
  /** Staggers siblings in a row so a three-card grid deals itself out. */
  delay?: number;
  /** "row" puts the visual beside the copy from `lg` up — for full-width cards. */
  layout?: "stack" | "row";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  visual: React.ReactNode;
}) {
  const heading = (
    <>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg border bg-background transition-colors group-hover:border-brand/40 group-hover:text-brand-accent">
        <Icon className="h-4 w-4" />
      </span>
      <h3 className="mt-4 text-base font-semibold tracking-tight">{title}</h3>
    </>
  );

  const shell =
    "group rounded-xl border bg-card p-6 transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lg";

  /*
   * `min-w-0` is load-bearing, not tidiness. A grid item's `min-width` defaults
   * to `auto`, which means it refuses to shrink below its own min-content
   * width — and these cards contain a nowrap URL and a fixed-width popup, so
   * their min-content is about 360px. Below roughly 360px of track the card
   * silently grew past its column instead of shrinking: on a 320px phone it
   * overhung the section by 59px. `min-w-0` lets the track do its job.
   */
  const cell = `min-w-0 scroll-mt-20 ${className}`;

  if (layout === "row") {
    return (
      <Reveal delay={delay} className={cell}>
        <article
          id={id}
          className={`grid ${shell} lg:grid-cols-2 lg:items-center lg:gap-10 lg:p-8`}
        >
          <div>
            {heading}
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">{body}</p>
          </div>
          <div className="mt-6 lg:mt-0">{visual}</div>
        </article>
      </Reveal>
    );
  }

  return (
    <Reveal delay={delay} className={cell}>
      <article id={id} className={`flex h-full flex-col ${shell}`}>
        {heading}
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
        <div className="mt-6 flex-1">{visual}</div>
      </article>
    </Reveal>
  );
}

/*
 * A miniature of the dashboard's "Stage reach" chart, and it has to be exactly
 * that: same three stages, same three fills, same value labels on the right.
 * It previously drew Applied and Interviewing in one black and Offer in brand
 * red, which is the colour this product uses for a rejection.
 *
 * The bars grow from the axis when the card arrives, once. They are drawn at
 * final width and the transition only borrows that, so a card whose observer
 * never fires shows the finished chart rather than an empty one.
 */
const funnel = [
  { label: "Applied", count: 14, width: "100%", status: "applied" },
  { label: "Interviewing", count: 4, width: "42%", status: "interviewing" },
  { label: "Offer", count: 1, width: "18%", status: "offer" },
] as const;

function FunnelVisual() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>();
  const grown = reduced || inView;

  return (
    <div ref={ref} className="flex h-full flex-col justify-end gap-3">
      {funnel.map((stage, index) => (
        <div key={stage.label} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-xs text-muted-foreground">{stage.label}</span>
          <span className="h-7 flex-1 overflow-hidden rounded-md bg-muted">
            <span
              className="block h-full rounded-md"
              style={{
                width: grown ? stage.width : "0%",
                background: statusFill[stage.status],
                transition: reduced
                  ? undefined
                  : `width 800ms cubic-bezier(.16,1,.3,1) ${index * 110}ms`,
              }}
            />
          </span>
          <span className="w-6 shrink-0 text-right text-xs font-medium tabular-nums">
            {grown ? <CountUp value={stage.count} duration={800} /> : 0}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * A browser window with the extension's popup overlaid, so the card reads as
 * "captured from a real page" rather than a bare data table.
 *
 * Four beats: an empty page, the popup opening, the fields reading themselves
 * out of the ad, the clip confirmed. That sequence is the entire pitch of the
 * extension, and it takes six seconds to watch instead of a paragraph to read.
 */
const CLIP_BEATS = [1100, 700, 1700, 2200] as const;

function ClipVisual() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>(false, 0.35);
  const [beat] = useLoop(CLIP_BEATS, inView && !reduced);

  /* Reduced motion lands on the finished frame: popup open, fields read,
   * clipped. The still is the last beat, not the first. */
  const open = reduced || beat >= 1;
  const read = reduced || beat >= 2;
  const clipped = reduced || beat >= 3;

  const fields: [string, string][] = [
    ["Company", "Stripe"],
    ["Role", "Staff Engineer"],
    ["Salary", "€95k–130k"],
  ];

  return (
    <div ref={ref} className="overflow-hidden rounded-lg border bg-background shadow-sm">
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
        <div
          className={`absolute right-4 top-4 w-48 overflow-hidden rounded-lg border bg-card shadow-lg transition-all duration-500 ease-[cubic-bezier(.16,1,.3,1)] sm:right-6 sm:top-6 sm:w-52 ${
            open ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0"
          }`}
        >
          <div className="flex items-center gap-1.5 border-b bg-muted/50 px-2.5 py-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-foreground">
              <Scissors className="h-3 w-3 text-background" aria-hidden="true" />
            </span>
            <span className="truncate text-[0.65rem] font-medium">Clip to Job Tracker</span>
          </div>
          <div className="space-y-1 px-2.5 py-2 text-[0.65rem]">
            {fields.map(([label, value], index) => (
              <div
                key={label}
                className="flex justify-between gap-2 transition-all duration-500"
                style={{
                  opacity: read ? 1 : 0,
                  transform: read ? "none" : "translateY(4px)",
                  transitionDelay: reduced ? undefined : `${index * 170}ms`,
                }}
              >
                <span className="shrink-0 text-muted-foreground">{label}</span>
                <span className="truncate font-medium">{value}</span>
              </div>
            ))}
          </div>
          <div className="border-t px-2.5 py-2">
            <span
              className={`flex items-center justify-center gap-1 rounded-full px-2 py-1 text-center text-[0.65rem] font-medium transition-all duration-300 ${
                clipped
                  ? "scale-100 bg-[var(--status-offer-soft)] text-[var(--status-offer-text)]"
                  : "scale-95 bg-muted text-muted-foreground"
              }`}
            >
              {clipped && <Check className="h-3 w-3" aria-hidden="true" />}
              {clipped ? "Clipped" : "Reading page…"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/*
 * Where a role sits in time, relative to you — the card version of the
 * WorkingHours panel on an application.
 *
 * Every number here is computed by `lib/time-zone`, the same functions the
 * detail page calls: `offsetBetween` measures the gap by formatting one
 * instant in two zones (so it is right across DST rather than right for half
 * the year), `workdayOverlap` intersects the two 9–18 days, and the sentence
 * underneath is `describeOverlap`'s own words. Nothing is hard-coded, which is
 * the point — if the overlap maths breaks, this card is wrong in public.
 *
 * And it is measured against *your* zone, not a stand-in for one. A visitor in
 * Vilnius and a visitor in Denver see different answers for the same four
 * cities, which is the whole argument the card is making.
 */
const ZONE_ROLES = [
  { city: "Amsterdam", zone: "Europe/Amsterdam" },
  { city: "New York", zone: "America/New_York" },
  { city: "San Francisco", zone: "America/Los_Angeles" },
  { city: "Singapore", zone: "Asia/Singapore" },
] as const;

const ZONE_BEATS = [2800, 2800, 2800, 2800] as const;

/*
 * The zone every role on this card is measured against.
 *
 * There is no such thing as "the visitor's zone" on the server, so the first
 * render uses the illustrative one and the real browser zone arrives after
 * mount. That is the trade `useUserZone` already makes inside the app, for the
 * same reason: computing it during SSR would produce different markup on each
 * side and a hydration error on every first paint.
 *
 * No permission prompt and no geolocation call is involved — `Intl` knows,
 * because the operating system told the browser. The card is normally still
 * below the fold when the swap happens, so in practice a visitor never sees
 * anything but their own hours.
 */
const SAMPLE_ZONE = "Europe/Amsterdam";

function useViewerZone() {
  const [zone, setZone] = useState<string>(SAMPLE_ZONE);

  useEffect(() => {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (resolved) setZone(resolved);
  }, []);

  return zone;
}

/** The shared band drawn against a 24-hour rail — the app's own OverlapBar. */
function OverlapRail({ offsetMinutes, animate }: { offsetMinutes: number; animate: boolean }) {
  const overlap = workdayOverlap(offsetMinutes);
  const pct = (hour: number) => `${(hour / 24) * 100}%`;
  const shared = overlap.hours > 0;
  /*
   * The band glides between two real overlaps, and vanishes instantly when
   * there is none. Transitioning into the empty state looked better and lied:
   * for the length of the ease there was still a green sliver on the rail
   * underneath a sentence reading "No overlap". A visual is not allowed to
   * argue with the line beside it, not even for 700ms.
   */
  const glide =
    animate && shared ? "transition-all duration-700 ease-[cubic-bezier(.16,1,.3,1)]" : "";

  return (
    <div className="space-y-1.5">
      <div className="relative h-7 overflow-hidden rounded-md border bg-muted/40">
        {/* Your working day, fixed — you are the thing being compared against. */}
        <div
          className="absolute inset-y-0 bg-foreground/15"
          style={{ left: pct(WORKDAY.start), width: pct(WORKDAY.end - WORKDAY.start) }}
        />
        {/* The shared window, drawn on top. It slides and resizes as the card
            moves between cities, which is the comparison made visible. */}
        <div
          className={`absolute inset-y-0 bg-[var(--status-offer)]/45 ${glide}`}
          style={{
            left: pct(overlap.yourStart ?? 12),
            width: shared ? pct(overlap.yourEnd! - overlap.yourStart!) : "0%",
            opacity: shared ? 1 : 0,
          }}
        />
        {[6, 12, 18].map((hour) => (
          <div
            key={hour}
            className="absolute inset-y-0 w-px bg-border"
            style={{ left: pct(hour) }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>
    </div>
  );
}

function TimeZoneVisual() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>(false, 0.35);
  const [beat] = useLoop(ZONE_BEATS, inView && !reduced);
  const viewerZone = useViewerZone();

  /* Null until mounted, so the clock cannot disagree between the server's
   * render and the browser's. It ticks on the same half-minute the app uses. */
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const role = ZONE_ROLES[beat];
  const offset = offsetBetween(role.zone, viewerZone, now ?? undefined);

  return (
    <div ref={ref} className="flex h-full flex-col justify-end gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium">{role.city}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {now && timeInZone(role.zone, now)} there
          {offset !== null && ` · ${formatOffset(offset)}`}
        </span>
      </div>

      {offset !== null ? (
        <>
          <OverlapRail offsetMinutes={offset} animate={!reduced} />
          <p className="text-sm">{describeOverlap(workdayOverlap(offset))}</p>
          <p className="text-xs text-muted-foreground">
            Against a {formatHour(WORKDAY.start)}–{formatHour(WORKDAY.end)} day, yours in{" "}
            {viewerZone.replace(/_/g, " ")}.
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Working out your time zone…</p>
      )}
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

/**
 * A mocked week view, so the pushed event reads as "on the calendar" rather
 * than a lone card — and now it is actually pushed: the task is dated, the day
 * marks itself, the event arrives under it. Three beats, because that is how
 * many steps the sync has.
 */
const CALENDAR_BEATS = [1500, 1300, 3000] as const;

function CalendarSyncVisual() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>(false, 0.35);
  const [beat] = useLoop(CALENDAR_BEATS, inView && !reduced);
  const todayIndex = 3;

  const marked = reduced || beat >= 1;
  const pushed = reduced || beat >= 2;

  return (
    <div ref={ref} className="overflow-hidden rounded-lg border bg-background shadow-sm">
      <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2">
        <CalendarSync
          className={`h-3.5 w-3.5 text-muted-foreground ${!reduced && beat === 1 ? "pulse-dot" : ""}`}
          aria-hidden="true"
        />
        <span className="text-xs font-medium">Google Calendar</span>
        <span
          className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-medium transition-colors duration-500 ${
            pushed
              ? "bg-[var(--status-offer-soft)] text-[var(--status-offer-text)]"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {pushed ? "Synced" : "Syncing…"}
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
              className={`relative flex h-7 items-center justify-center rounded-full transition-colors duration-500 ${
                i === todayIndex && marked ? "bg-foreground font-medium text-background" : ""
              }`}
            >
              {w.date}
              {i === todayIndex && (
                <span
                  className="absolute -bottom-1.5 h-1 w-1 rounded-full transition-all duration-500"
                  style={{
                    background: "var(--status-interviewing)",
                    opacity: marked ? 1 : 0,
                    transform: marked ? "scale(1)" : "scale(0)",
                  }}
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
          className="absolute left-1/2 top-[0.45rem] h-2 w-2 -translate-x-1/2 rotate-45 bg-[var(--status-interviewing-soft)] transition-opacity duration-500"
          style={{ opacity: pushed ? 1 : 0 }}
          aria-hidden="true"
        />
        <div
          className="rounded-md border-l-4 border-[var(--status-interviewing)] bg-[var(--status-interviewing-soft)] px-3 py-2 text-xs transition-all duration-500 ease-[cubic-bezier(.16,1,.3,1)]"
          style={{
            opacity: pushed ? 1 : 0,
            transform: pushed ? "none" : "translateY(0.6rem) scale(0.97)",
          }}
        >
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
 *
 * The loop shows the only interaction that matters here: you tick today's
 * task, and the highlight moves down to the next one. "First in line" is a
 * claim about what happens after you act, which is hard to draw as a still.
 */
const followUps = [
  { label: "Send portfolio", role: "Stripe · Staff Engineer", when: "Done" },
  { label: "Thank-you note", role: "Figma · Design Lead", when: "Today" },
  { label: "Prep system design round", role: "Linear · Product Designer", when: "Wed" },
  { label: "Ask about relocation", role: "Vercel · Eng Manager", when: "Next week" },
] as const;

const TASK_BEATS = [2400, 1300, 2600] as const;

function TasksVisual() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLUListElement>(false, 0.35);
  const [beat] = useLoop(TASK_BEATS, inView && !reduced);

  /* One index does both jobs: everything before it is done, and it is the row
   * that is due today. Beat 1 is the tick itself — the row is complete but the
   * queue has not moved on yet, which is what makes the hand-off legible. */
  const doneThrough = beat >= 1 ? 1 : 0;
  const current = beat >= 2 ? 2 : 1;

  return (
    <ul ref={ref} className="flex h-full flex-col justify-center gap-1.5">
      {followUps.map((task, index) => {
        const done = index <= doneThrough;
        const due = index === current && !done;
        const when = index === current ? "Today" : task.when;

        return (
          <li
            key={task.label}
            className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs transition-all duration-500 ${
              due
                ? "bg-[var(--status-interviewing-soft)] ring-1 ring-inset ring-[var(--status-interviewing)]/25"
                : ""
            }`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-300 ${
                done ? "border-foreground bg-foreground" : "border-input bg-background"
              }`}
              aria-hidden="true"
            >
              {done && <Check className="h-3 w-3 text-background" />}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={`block truncate font-medium transition-colors duration-300 ${
                  done ? "text-muted-foreground line-through" : ""
                }`}
              >
                {task.label}
              </span>
              <span className="block truncate text-[0.65rem] text-muted-foreground">
                {task.role}
              </span>
            </span>
            <span
              className={`shrink-0 text-[0.65rem] font-medium ${
                due ? "text-[var(--status-interviewing-text)]" : "text-muted-foreground"
              }`}
            >
              {done ? "Done" : when}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const weeks = [38, 55, 30, 72, 48, 90, 64];

/*
 * Volume, so ink — the same reasoning as the dashboard's per-week chart, where
 * a bar counts applications rather than outcomes. The busiest week is picked
 * out in gold rather than red: it is the week worth noticing, not a warning.
 *
 * The columns grow from the baseline, left to right, once the card is on
 * screen. Final heights are what the markup says; the transition borrows them.
 */
function BarsVisual() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>();
  const grown = reduced || inView;
  const peak = Math.max(...weeks);

  return (
    <div ref={ref} className="flex h-24 items-end gap-1.5">
      {weeks.map((height, i) => (
        <span
          key={i}
          className="flex-1 rounded-sm"
          style={{
            height: grown ? `${height}%` : "2%",
            background: height === peak ? statusFill.interviewing : statusFill.applied,
            transition: reduced ? undefined : `height 700ms cubic-bezier(.16,1,.3,1) ${i * 70}ms`,
          }}
        />
      ))}
    </div>
  );
}

/* Each dot wears the status it records — the trail reads as the same pipeline
 * the badges do, newest first. The rule draws itself downward and the dots
 * land on it in order, which is the one thing a still timeline cannot say:
 * that this is a record accumulating over time. */
const timeline = [
  { label: "Offer", date: "Jul 24", status: "offer" },
  { label: "Interviewing", date: "Jul 09", status: "interviewing" },
  { label: "Applied", date: "Jun 30", status: "applied" },
] as const;

function TimelineVisual() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLOListElement>();
  const drawn = reduced || inView;

  return (
    <ol ref={ref} className="relative flex h-full flex-col justify-end gap-3 pl-4">
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-px origin-bottom bg-border"
        style={{
          transform: drawn ? "scaleY(1)" : "scaleY(0)",
          transition: reduced ? undefined : "transform 600ms cubic-bezier(.16,1,.3,1)",
        }}
      />
      {timeline.map((entry, index) => (
        <li key={entry.label} className="relative text-xs">
          <span
            className="absolute -left-[1.31rem] top-1 h-2 w-2 rounded-full ring-2 ring-card"
            style={{
              background: statusFill[entry.status],
              transform: drawn ? "scale(1)" : "scale(0)",
              transition: reduced
                ? undefined
                : `transform 420ms cubic-bezier(.34,1.56,.64,1) ${420 + (timeline.length - 1 - index) * 140}ms`,
            }}
            aria-hidden="true"
          />
          <span className="font-medium">{entry.label}</span>
          <span className="ml-2 text-muted-foreground">{entry.date}</span>
        </li>
      ))}
    </ol>
  );
}

/*
 * The importer, mid-import. Rows stream in the way the parser hands them over,
 * and the count underneath is the same line the real import reports.
 */
const csvPreview = [
  { cells: ["company", "position", "status"], head: true },
  { cells: ["Stripe", "Sr. Product Designer", "interviewing"] },
  { cells: ["Figma", "Design Lead", "offer"] },
  { cells: ["Linear", "Product Designer", "applied"] },
];

const IMPORT_BEATS = [900, 700, 700, 2600] as const;

function ImportVisual() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>(false, 0.35);
  const [beat] = useLoop(IMPORT_BEATS, inView && !reduced);
  const rowsIn = reduced ? csvPreview.length : beat + 1;

  return (
    <div ref={ref} className="overflow-hidden rounded-lg border bg-background">
      <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2">
        <FileUp className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="font-mono text-[0.7rem] text-muted-foreground">applications.csv</span>
        <span className="ml-auto text-[0.65rem] font-medium tabular-nums text-muted-foreground">
          {Math.max(0, rowsIn - 1)} of 3 imported
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[22rem] text-left font-mono text-[0.7rem]">
          <tbody className="divide-y">
            {csvPreview.map((row, index) => (
              <tr
                key={row.cells[0]}
                className={`transition-all duration-500 ease-[cubic-bezier(.16,1,.3,1)] ${
                  row.head ? "bg-muted/30" : ""
                }`}
                style={{
                  opacity: index < rowsIn ? 1 : 0,
                  transform: index < rowsIn ? "none" : "translateX(-0.5rem)",
                }}
              >
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
      <div className="h-0.5 w-full bg-muted">
        <div
          className="h-full bg-brand"
          style={{
            width: `${(Math.max(0, rowsIn - 1) / 3) * 100}%`,
            transition: reduced ? undefined : "width 500ms cubic-bezier(.16,1,.3,1)",
          }}
        />
      </div>
    </div>
  );
}

/*
 * The one card whose claim is about absence, which is hard to animate without
 * lying. So it does the only honest thing: the lock closes, and a light passes
 * over the two redacted lines without ever revealing them.
 */
function PrivacyVisual() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>();
  const shut = reduced || inView;

  return (
    <div ref={ref} className="flex h-full items-end">
      <div className="relative w-full overflow-hidden rounded-lg border border-dashed bg-muted/60 px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-medium">
          {/* The shackle drops into the body: a lock closing, not a lock icon
              fading in. It is a two-pixel move, which is all the emphasis a
              claim about absence should get. */}
          <Lock
            className="h-3.5 w-3.5 text-brand-accent"
            style={{
              transform: shut ? "none" : "translateY(-2px) scale(0.92)",
              transition: reduced ? undefined : "transform 500ms cubic-bezier(.34,1.56,.64,1)",
            }}
            aria-hidden="true"
          />
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

/**
 * The last screen: ink ground, one claim, one button.
 *
 * Inverted from the rest of the page on purpose — after four white-and-grey
 * sections, a black field is the strongest signal available that the argument
 * is over and there is one thing left to do. The red field behind it is the
 * same drifting aurora as the hero, which closes the page where it opened.
 */
function ClosingCta() {
  return (
    <section className="relative isolate overflow-hidden bg-foreground text-background">
      <div
        aria-hidden="true"
        className="aurora-a pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-30 blur-3xl"
        style={{ background: "var(--brand)" }}
      />
      <div
        aria-hidden="true"
        className="aurora-b pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--brand)" }}
      />

      <div className="container-page relative py-20 text-center sm:py-28">
        <Reveal variant="scale">
          <span className="inline-flex items-center gap-2 rounded-full border border-background/20 px-3 py-1 text-xs font-medium text-background/70">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Under a minute to your first application
          </span>
        </Reveal>

        <Reveal delay={100}>
          <h2 className="mx-auto mt-6 max-w-3xl text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
            Every offer starts with one tracked application.
          </h2>
        </Reveal>

        <Reveal delay={180}>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-background/70 sm:text-base">
            Add your first application in under a minute and see the whole picture from day one.
          </p>
        </Reveal>

        <Reveal delay={260}>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="sheen h-11 w-full bg-background px-7 text-sm text-foreground hover:bg-background/90 sm:w-auto"
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
        </Reveal>
      </div>
    </section>
  );
}
