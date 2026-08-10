import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Blend,
  Building2,
  Clock,
  Globe,
  ListChecks,
  StickyNote,
  TriangleAlert,
} from "lucide-react";
import { ACTIVE_STATUSES, CLOSED_STATUSES, statusColor, type Status } from "@/lib/status";
import { faviconUrl, GENERIC_FAVICON_SIZE } from "@/lib/company-logo";
import { flagForCountry, jobTypeMeta, type JobType } from "@/lib/job-location";
import { daysAgo, relativeDay, relativeDue } from "@/lib/relative-time";

export type LinkedTask = { id: string; due_date: string | null; done: boolean };

export type ApplicationCardData = {
  id: string;
  company: string;
  position: string;
  status: Status;
  application_date: string;
  notes: string | null;
  website: string | null;
  job_type: string | null;
  country: string | null;
  city: string | null;
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

function CompanyLogo({
  company,
  website,
  dim,
}: {
  company: string;
  website: string | null;
  dim?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const url = faviconUrl(website);
  const showImg = !!url && !failed;
  const initial = company.trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border text-sm font-medium ${
        showImg ? "bg-white" : "bg-muted"
      } ${dim ? "text-muted-foreground" : "text-foreground/70"}`}
    >
      {showImg ? (
        <img
          src={url}
          alt=""
          width={36}
          height={36}
          loading="lazy"
          className="h-full w-full object-contain p-1"
          onError={() => setFailed(true)}
          onLoad={(e) => {
            // A domain with no real favicon comes back as a 16px generic globe —
            // treat only that (not a smaller-but-real mark) as a miss.
            if (e.currentTarget.naturalWidth <= GENERIC_FAVICON_SIZE) setFailed(true);
          }}
        />
      ) : (
        initial
      )}
    </div>
  );
}

const JOB_TYPE_ICON: Record<JobType, typeof Globe> = {
  remote: Globe,
  hybrid: Blend,
  onsite: Building2,
};

const JOB_TYPE_CHIP: Record<JobType, string> = {
  remote: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
  hybrid: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
  onsite: "bg-stone-200/70 text-stone-700 dark:bg-stone-800/60 dark:text-stone-300",
};

/** Job type pill + a location pill (flag · City, Country) when we have either. */
function LocationRow({ app }: { app: ApplicationCardData }) {
  const meta = jobTypeMeta(app.job_type);
  const city = app.city?.trim();
  const country = app.country?.trim();
  const place = [city, country].filter(Boolean).join(", ");
  if (!meta && !place) return null;

  const Icon = meta ? JOB_TYPE_ICON[app.job_type as JobType] : null;
  const flag = flagForCountry(country);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {meta && Icon && (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
            JOB_TYPE_CHIP[app.job_type as JobType]
          }`}
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
    </div>
  );
}

function TaskChip({
  openCount,
  nextDue,
  overdue,
}: {
  openCount: number;
  nextDue: string | null;
  overdue: boolean;
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
      <ListChecks className="h-3.5 w-3.5" /> {label}
    </span>
  );
}

function StalledPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--status-interviewing-soft)] px-2 py-0.5 text-xs text-[var(--status-interviewing-text)]">
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
        title={`Applied ${new Date(app.application_date).toLocaleDateString()}`}
      >
        <Clock className="h-3.5 w-3.5" /> {relativeDay(app.application_date)}
      </span>
      {meta.stalled ? (
        <StalledPill />
      ) : (
        <TaskChip openCount={meta.openCount} nextDue={meta.nextDue} overdue={meta.overdue} />
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

export function ApplicationCard({
  app,
  variant,
}: {
  app: ApplicationCardData;
  variant: "list" | "grid";
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

  const badge = (
    <Badge className={statusColor[app.status] + " shrink-0 capitalize"} variant="outline">
      {app.status}
    </Badge>
  );

  if (variant === "grid") {
    return (
      <Link to="/applications/$id" params={{ id: app.id }} className="block h-full">
        <Card
          className={`flex h-full flex-col gap-3 p-4 transition-colors hover:border-foreground/20 hover:bg-accent/40 ${
            meta.isClosed ? "bg-muted/30" : ""
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            {identity}
            {badge}
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
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          {identity}
          {badge}
        </div>
        <div className="mt-3 space-y-2">
          <LocationRow app={app} />
          <CardMeta app={app} meta={meta} />
        </div>
      </Card>
    </Link>
  );
}
