import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Banknote,
  Blend,
  Building2,
  Clock,
  Globe,
  ListChecks,
  Star,
  StickyNote,
  TriangleAlert,
} from "lucide-react";
import { ACTIVE_STATUSES, CLOSED_STATUSES, statusColor, type Status } from "@/lib/status";
import { CompanyLogo } from "@/components/CompanyLogo";
import { flagForCountry, jobTypeMeta, type JobType } from "@/lib/job-location";
import { formatSalary, type SalaryPeriod } from "@/lib/job-ad";
import { daysAgo, relativeDay, relativeDue } from "@/lib/relative-time";

export type LinkedTask = {
  id: string;
  due_date: string | null;
  done: boolean;
  priority: boolean;
};

export type ApplicationCardData = {
  id: string;
  company: string;
  position: string;
  status: Status;
  priority: boolean;
  application_date: string;
  notes: string | null;
  website: string | null;
  job_type: string | null;
  country: string | null;
  city: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  task_applications?: { task: LinkedTask | null }[];
};

/** Everything the card derives from the raw row, computed once per render. */
function deriveMeta(app: ApplicationCardData) {
  const openTasks = (app.task_applications ?? [])
    .map((t) => t.task)
    .filter((t): t is LinkedTask => !!t && !t.done);
  const nextDue =
    openTasks
      .map((t) => t.due_date)
      .filter((d): d is string => !!d)
      .sort()[0] ?? null;

  return {
    openCount: openTasks.length,
    nextDue,
    hasPriority: openTasks.some((t) => t.priority),
    overdue: nextDue ? daysAgo(nextDue) > 0 : false,
    isClosed: CLOSED_STATUSES.includes(app.status),
    // The classic silently-dying application: still live, nothing owed on it,
    // and no movement in a month.
    stalled:
      ACTIVE_STATUSES.includes(app.status) &&
      openTasks.length === 0 &&
      daysAgo(app.application_date) >= 30,
    hasNotes: !!app.notes?.trim(),
  };
}

const JOB_TYPE_ICON: Record<JobType, typeof Globe> = {
  remote: Globe,
  hybrid: Blend,
  onsite: Building2,
};

/*
 * Job type is metadata, not status, so it spends no hue.
 *
 * These three chips used to be sky / violet / stone straight from the Tailwind
 * palette — the only colours in the app outside the token system, so a
 * "Remote" chip read as a status badge on a card that carries a real one two
 * inches to the right, and stone is a warm neutral in a palette whose rule is
 * that neutrals are chroma 0 and never drift warm or blue.
 *
 * What separates this chip from the location pill beside it is now weight
 * rather than colour: bordered with foreground text here, flat muted fill
 * there. The icon — globe, blend, building — already tells the three types
 * apart without help.
 */
const JOB_TYPE_CHIP = "border bg-background font-medium text-foreground";

/**
 * The facts row: how the role is worked, where it's based, and what it pays.
 * Salary is the one a user scans for, so it carries the foreground weight the
 * location pill doesn't.
 */
function LocationRow({ app }: { app: ApplicationCardData }) {
  const meta = jobTypeMeta(app.job_type);
  const city = app.city?.trim();
  const country = app.country?.trim();
  const place = [city, country].filter(Boolean).join(", ");
  const salary = formatSalary({
    salary_min: app.salary_min,
    salary_max: app.salary_max,
    salary_currency: app.salary_currency,
    salary_period: app.salary_period as SalaryPeriod | null,
  });
  if (!meta && !place && !salary) return null;

  const Icon = meta ? JOB_TYPE_ICON[app.job_type as JobType] : null;
  const flag = flagForCountry(country);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {meta && Icon && (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${JOB_TYPE_CHIP}`}
        >
          <Icon className="h-3.5 w-3.5" /> {meta.short}
        </span>
      )}
      {place && (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {flag ? <span aria-hidden>{flag}</span> : null}
          {place}
        </span>
      )}
      {salary && (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${JOB_TYPE_CHIP}`}
        >
          <Banknote className="h-3.5 w-3.5" /> {salary}
        </span>
      )}
    </div>
  );
}

function TaskChip({
  openCount,
  nextDue,
  overdue,
  hasPriority,
}: {
  openCount: number;
  nextDue: string | null;
  overdue: boolean;
  hasPriority: boolean;
}) {
  if (openCount === 0) return null;
  const noun = `${openCount} task${openCount === 1 ? "" : "s"}`;
  const label = nextDue ? `${noun} · ${relativeDue(nextDue)}` : noun;
  const tone = overdue
    ? "bg-[var(--status-rejected-soft)] text-[var(--status-rejected-text)]"
    : nextDue
      ? "bg-[var(--status-interviewing-soft)] text-[var(--status-interviewing-text)]"
      : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${tone}`}>
      {hasPriority ? (
        <Star
          className="h-3.5 w-3.5 fill-[var(--status-interviewing-text)] text-[var(--status-interviewing-text)]"
          aria-label="Has a high-priority task"
        />
      ) : (
        <ListChecks className="h-3.5 w-3.5" />
      )}{" "}
      {label}
    </span>
  );
}

/**
 * Stalled is an observation about silence, not a status, so it holds no status
 * hue.
 *
 * It used to wear `--status-interviewing` — gold, the token whose documented
 * meaning is "live and moving". Stalled means the exact opposite: active, and
 * nothing has happened in thirty days. On a card whose badge already reads
 * `Interviewing` in that same gold, the two sat inches apart saying opposite
 * things in one colour, against the rule that a shared hue is a shared
 * meaning.
 *
 * The dashed edge is doing the work colour was: it reads as dormancy — an
 * outline round nothing — which is the state it is reporting.
 */
function StalledPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground">
      <TriangleAlert className="h-3.5 w-3.5" /> Stalled
    </span>
  );
}

/** The shared meta row: how long ago, what's owed, and whether notes exist. */
function CardMeta({
  app,
  meta,
}: {
  app: ApplicationCardData;
  meta: ReturnType<typeof deriveMeta>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
        // The tooltip date renders in the viewer's locale, so the server (its
        // own locale) and client can format the same day differently. That's
        // cosmetic and unavoidable, so tell React not to flag the mismatch.
        suppressHydrationWarning
        title={`Applied ${new Date(app.application_date).toLocaleDateString()}`}
      >
        <Clock className="h-3.5 w-3.5" /> {relativeDay(app.application_date)}
      </span>
      {meta.stalled ? (
        <StalledPill />
      ) : (
        <TaskChip
          openCount={meta.openCount}
          nextDue={meta.nextDue}
          overdue={meta.overdue}
          hasPriority={meta.hasPriority}
        />
      )}
      {meta.hasNotes && (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="ml-auto flex shrink-0" aria-label="Has notes">
                <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
            </TooltipTrigger>
            <TooltipContent>Has notes</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

/**
 * Priority star for the opportunity itself — pins a dream-role application to
 * the top of the board. Lives inside the card's Link, so the click is stopped
 * from navigating. Outline when normal, filled gold when high, reusing the
 * same star + token as the task-level flag so priority reads the same way
 * everywhere. Gold is the right hue for it twice over: it is the palette's
 * "this is live" colour, and a gold star is already what a starred thing
 * looks like.
 */
function AppStar({
  app,
  onToggle,
}: {
  app: ApplicationCardData;
  onToggle: (priority: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle(!app.priority);
      }}
      aria-pressed={app.priority}
      aria-label={
        app.priority
          ? `Remove priority from ${app.position} at ${app.company}`
          : `Mark ${app.position} at ${app.company} high priority`
      }
      className={`shrink-0 rounded-md p-1 transition-colors ${
        app.priority
          ? "text-[var(--status-interviewing-text)]"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Star className={`h-4 w-4 ${app.priority ? "fill-current" : ""}`} />
    </button>
  );
}

export function ApplicationCard({
  app,
  variant,
  onTogglePriority,
}: {
  app: ApplicationCardData;
  variant: "list" | "grid";
  onTogglePriority: (priority: boolean) => void;
}) {
  const meta = deriveMeta(app);
  const dimTitle = meta.isClosed ? "text-muted-foreground" : "";

  const identity = (
    <div className="flex min-w-0 items-center gap-3">
      <CompanyLogo company={app.company} website={app.website} dim={meta.isClosed} />
      <div className="min-w-0">
        <p className={`truncate font-medium ${dimTitle}`}>{app.position}</p>
        <p className="truncate text-sm text-muted-foreground">{app.company}</p>
      </div>
    </div>
  );

  const rightCluster = (
    <div className="flex shrink-0 items-center gap-1.5">
      <AppStar app={app} onToggle={onTogglePriority} />
      <Badge className={statusColor[app.status] + " capitalize"} variant="outline">
        {app.status}
      </Badge>
    </div>
  );

  if (variant === "grid") {
    return (
      <Link to="/applications/$id" params={{ id: app.id }} className="block h-full">
        <Card
          className={`flex h-full flex-col gap-3 p-4 transition-colors hover:border-foreground/20 hover:bg-accent/40 ${
            meta.isClosed ? "bg-muted/30" : ""
          } ${app.priority ? "border-[var(--status-interviewing-text)]/40" : ""}`}
        >
          <div className="flex items-start justify-between gap-3">
            {identity}
            {rightCluster}
          </div>
          <LocationRow app={app} />
          <div className="mt-auto border-t pt-3">
            <CardMeta app={app} meta={meta} />
          </div>
        </Card>
      </Link>
    );
  }

  return (
    <Link to="/applications/$id" params={{ id: app.id }} className="block">
      <Card
        className={`p-4 transition-colors hover:border-foreground/20 hover:bg-accent/40 sm:p-5 ${
          meta.isClosed ? "bg-muted/30" : ""
        } ${app.priority ? "border-[var(--status-interviewing-text)]/40" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          {identity}
          {rightCluster}
        </div>
        <div className="mt-3 space-y-2">
          <LocationRow app={app} />
          <CardMeta app={app} meta={meta} />
        </div>
      </Card>
    </Link>
  );
}
