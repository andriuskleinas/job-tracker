import { useRef, useState, type ReactNode } from "react";
import { CompanyLogo } from "@/components/CompanyLogo";
import { addDays, format } from "date-fns";
import { ChevronDown, CornerDownLeft, Globe, Sparkles, Undo2, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LocationFields, type LocationValue } from "@/components/LocationFields";
import { JobAdFields } from "@/components/JobAdFields";
import { cn } from "@/lib/utils";
import { STATUSES, statusLabel, type Status } from "@/lib/status";
import { JOB_TYPE_META } from "@/lib/job-location";
import { formatSalary } from "@/lib/job-ad";
import { EMPTY_JOB_AD, MAX_AD_LENGTH, jobAdSchema, type JobAdValue } from "@/lib/job-ad-form";
import { newApplicationSchema, type NewApplicationValues } from "@/lib/application-form";
import { readQuickFill, type QuickFill } from "@/lib/quick-fill";

export type NewApplicationSubmit = NewApplicationValues & { jobAd: JobAdValue };

type Draft = {
  company: string;
  position: string;
  status: Status;
  application_date: string;
  website: string;
  /**
   * Where the website came from when we filled it: the job link, or a lookup
   * by company name. Empty once the user types it (or it was never filled) —
   * then it's theirs, and no later paste or lookup touches it.
   */
  websiteFrom: "" | "link" | "lookup";
  notes: string;
  task_title: string;
  task_due_date: string;
};

/** Fields the paste box can fill, marked until the user edits them. */
type FilledKey = "company" | "position";

type Summary = { label: string; value: string; warn?: boolean }[];

type Snapshot = {
  draft: Draft;
  location: LocationValue;
  jobAd: JobAdValue;
  filled: FilledKey[];
  locationTouched: boolean;
};

const isoDate = (d: Date) => format(d, "yyyy-MM-dd");

const blankDraft = (): Draft => ({
  company: "",
  position: "",
  status: "applied",
  // Local, not UTC — logging a role at 00:30 in Vilnius is still today.
  application_date: isoDate(new Date()),
  website: "",
  websiteFrom: "",
  notes: "",
  task_title: "",
  task_due_date: "",
});

const DEFAULT_LOCATION: LocationValue = { job_type: "onsite", country: "", city: "" };

/**
 * The next thing most people owe a role in each status, one click to set.
 * They only fill the task fields — the title and date stay editable.
 */
const FOLLOW_UPS: Record<Status, { title: string; days: number }[]> = {
  wishlist: [
    { title: "Send the application", days: 2 },
    { title: "Tailor my CV for this role", days: 1 },
  ],
  applied: [
    { title: "Follow up if no reply", days: 7 },
    { title: "Follow up if no reply", days: 14 },
  ],
  interviewing: [
    { title: "Prepare for the interview", days: 1 },
    { title: "Send a thank-you note", days: 1 },
  ],
  offer: [{ title: "Reply to the offer", days: 3 }],
  rejected: [{ title: "Ask for feedback", days: 2 }],
  withdrawn: [],
};

function inDays(days: number): string {
  if (days === 1) return "tomorrow";
  if (days % 7 === 0) return days === 7 ? "in 1 week" : `in ${days / 7} weeks`;
  return `in ${days} days`;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * New application: one short screen to log a role, with the full record one
 * click further down.
 *
 * The journey it is built around is "paste, check, save". The box at the top
 * takes a link or the whole ad and fills everything it can read — company,
 * title, location, work mode, salary, requirements, the ad itself — into the
 * same visible fields someone would otherwise type, marks what it filled, and
 * says what it found. Nothing is filled that the user has already typed, and
 * one click undoes the lot.
 *
 * The draft lives here, not in the dialog body, so closing the dialog by
 * accident (a stray click outside, Esc) loses nothing; it clears only once
 * the role is saved, or when asked to.
 */
export function NewApplicationDialog({
  open,
  onOpenChange,
  trigger,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  isPending: boolean;
  /** Resolves once the role is saved; the draft is cleared then. */
  onSubmit: (values: NewApplicationSubmit) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [location, setLocation] = useState<LocationValue>(DEFAULT_LOCATION);
  const [jobAd, setJobAd] = useState<JobAdValue>(EMPTY_JOB_AD);
  const [filled, setFilled] = useState<FilledKey[]>([]);
  // Once someone picks a job type or place themselves, a later paste leaves
  // it alone — the default "On-site" is not a choice, so it can be replaced.
  const [locationTouched, setLocationTouched] = useState(false);
  const [paste, setPaste] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [undo, setUndo] = useState<Snapshot | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<"company" | "position", string>>>({});
  const companyRef = useRef<HTMLInputElement>(null);
  const positionRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const blank = blankDraft();
  const dirty =
    (Object.keys(blank) as (keyof Draft)[]).some(
      (k) => k !== "application_date" && draft[k] !== blank[k],
    ) ||
    location.job_type !== DEFAULT_LOCATION.job_type ||
    !!location.city ||
    !!location.country ||
    Object.values(jobAd).some(Boolean);

  const salary = formatSalary({
    salary_min: jobAd.salary_min ? Number(jobAd.salary_min) : null,
    salary_max: jobAd.salary_max ? Number(jobAd.salary_max) : null,
    salary_currency: jobAd.salary_currency || null,
    salary_period: (jobAd.salary_period || null) as never,
  });
  const detailCount = [
    jobAd.job_url,
    salary,
    jobAd.requirements,
    jobAd.description,
    draft.notes,
    draft.task_title,
  ].filter(Boolean).length;

  const reset = () => {
    setDraft(blankDraft());
    setLocation(DEFAULT_LOCATION);
    setJobAd(EMPTY_JOB_AD);
    setFilled([]);
    setLocationTouched(false);
    setPaste("");
    setSummary(null);
    setUndo(null);
    setDetailsOpen(false);
    setErrors({});
  };

  /** A typed edit: the field is the user's now, so drop its "filled" mark. */
  const edit = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value, ...(key === "website" && { websiteFrom: "" }) }));
    if (filled.includes(key as FilledKey)) setFilled((f) => f.filter((k) => k !== key));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  // Latest lookup wins: typing "Wi" then "Wix" must not land Wi's answer.
  const lookupSeq = useRef(0);
  const [lookingUp, setLookingUp] = useState(false);

  /** A name to go on, and a website field that's empty or holds our own guess. */
  const needsWebsiteLookup = (d: Draft) =>
    d.company.trim().length >= 2 && (!d.website.trim() || d.websiteFrom === "lookup");

  /**
   * Find the company's website from its name (see company-website.server.ts)
   * and fill it in, unless the user has put their own there meanwhile. A miss
   * clears an earlier guess made for a different name.
   */
  const lookUpWebsite = async (rawName: string) => {
    const name = rawName.trim();
    const seq = ++lookupSeq.current;
    setLookingUp(true);
    let website: string | null = null;
    try {
      const res = await fetch(`/company-website?name=${encodeURIComponent(name)}`);
      if (res.ok) website = ((await res.json()) as { website: string | null }).website;
    } catch {
      // Offline or the lookup failed — the field just stays as it is.
    }
    if (seq !== lookupSeq.current) return;
    setLookingUp(false);
    setDraft((d) =>
      d.company.trim() !== name || (d.website.trim() && d.websiteFrom !== "lookup")
        ? d
        : { ...d, website: website ?? "", websiteFrom: website ? "lookup" : "" },
    );
  };

  const applyFill = (fill: QuickFill) => {
    setUndo({ draft, location, jobAd, filled, locationTouched });

    const nextDraft = { ...draft };
    const nextFilled = new Set(filled);
    // Empty fields and ones an earlier paste filled are fair game; anything
    // the user typed is theirs.
    const take = (key: FilledKey, value: string | null) => {
      if (!value || (draft[key].trim() && !filled.includes(key))) return false;
      nextDraft[key] = value;
      nextFilled.add(key);
      return true;
    };
    const found: Summary = [];
    if (take("company", fill.company)) found.push({ label: "Company", value: fill.company! });
    if (take("position", fill.position)) found.push({ label: "Position", value: fill.position! });
    // The employer's own domain from the link beats a lookup by name.
    if (fill.website && (!draft.website.trim() || draft.websiteFrom)) {
      nextDraft.website = fill.website;
      nextDraft.websiteFrom = "link";
    }

    const nextLocation = { ...location };
    if (!locationTouched) {
      if (fill.job_type) nextLocation.job_type = fill.job_type;
      if (fill.city) nextLocation.city = fill.city;
      if (fill.country) nextLocation.country = fill.country;
      const where = [
        fill.job_type && JOB_TYPE_META[fill.job_type].short,
        [fill.city, fill.country].filter(Boolean).join(", "),
      ].filter(Boolean);
      if (where.length) found.push({ label: "Location", value: where.join(" · ") });
    }

    const nextAd = { ...jobAd };
    if (fill.job_url && !jobAd.job_url) nextAd.job_url = fill.job_url;
    if (fill.ad) {
      const { ad } = fill;
      nextAd.description = ad.description;
      if (ad.requirements) nextAd.requirements = ad.requirements;
      if (ad.salary) {
        nextAd.salary_min = ad.salary.salary_min?.toString() ?? "";
        nextAd.salary_max = ad.salary.salary_max?.toString() ?? "";
        nextAd.salary_currency = ad.salary.salary_currency ?? "";
        nextAd.salary_period = ad.salary.salary_period ?? "";
        nextAd.salary_source = jobAd.salary_source || "posted";
      }
      const band = ad.salary ? formatSalary(ad.salary) : null;
      found.push(
        band
          ? {
              label: "Salary",
              value: ad.salary?.confidence === "low" ? `${band} — worth checking` : band,
              warn: ad.salary?.confidence === "low",
            }
          : { label: "Salary", value: "Not in the ad", warn: true },
      );
      if (ad.requirements) found.push({ label: "Requirements", value: "Found" });
      found.push({
        label: "Full ad",
        value: `${ad.description.length.toLocaleString()} characters saved`,
      });
    } else if (fill.job_url) {
      found.push({ label: "Link", value: "Saved" });
    }

    setDraft(nextDraft);
    setFilled([...nextFilled]);
    if (needsWebsiteLookup(nextDraft)) void lookUpWebsite(nextDraft.company);
    setLocation(nextLocation);
    setJobAd(nextAd);
    setSummary(found);
    setErrors({});

    // Straight on to whatever is still missing — usually nothing but Save.
    requestAnimationFrame(() => {
      if (!nextDraft.company.trim()) companyRef.current?.focus();
      else if (!nextDraft.position.trim()) positionRef.current?.focus();
    });
  };

  const read = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    if (text.length > MAX_AD_LENGTH) {
      toast.error(
        `That's ${Math.round(text.length / 1000)}k characters — paste just the job ad, up to ${MAX_AD_LENGTH / 1000}k.`,
      );
      return;
    }
    applyFill(readQuickFill(text));
    setPaste("");
  };

  const undoFill = () => {
    if (!undo) return;
    setDraft(undo.draft);
    setLocation(undo.location);
    setJobAd(undo.jobAd);
    setFilled(undo.filled);
    setLocationTouched(undo.locationTouched);
    setUndo(null);
    setSummary(null);
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = newApplicationSchema.safeParse({
      ...draft,
      job_type: location.job_type,
      country: location.country,
      city: location.city,
    });
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if ((key === "company" || key === "position") && !next[key]) next[key] = issue.message;
      }
      if (next.company || next.position) {
        setErrors(next);
        (next.company ? companyRef : positionRef).current?.focus();
      } else {
        toast.error(parsed.error.issues[0].message);
      }
      return;
    }
    const ad = jobAdSchema.safeParse(jobAd);
    if (!ad.success) {
      // The salary rules live in the details — open them so the problem is
      // on screen, not just in a toast.
      setDetailsOpen(true);
      toast.error(ad.error.issues[0].message);
      return;
    }
    onSubmit({ ...parsed.data, jobAd })
      .then(reset)
      .catch(() => {
        // The caller's mutation already reported the error; keep the draft.
      });
  };

  const followUps = FOLLOW_UPS[draft.status];
  const filledStyle = "border-[var(--status-offer-text)]/40 bg-[var(--status-offer-soft)]/40";
  const filledClass = (key: FilledKey) => filled.includes(key) && filledStyle;
  const websiteHint = lookingUp
    ? "Looking up the company's website…"
    : draft.websiteFrom === "link"
      ? "Taken from the job link."
      : draft.websiteFrom === "lookup"
        ? `Found for “${draft.company.trim()}” — check it's the right company.`
        : "Shows the company logo on your board. Found from the company name when we can.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4">
          <DialogTitle>New application</DialogTitle>
          <DialogDescription>
            Only company and position are required. Everything else can wait.
          </DialogDescription>
        </DialogHeader>
        <form
          ref={formRef}
          noValidate
          onSubmit={submit}
          onKeyDown={(e) => {
            // ⌘/Ctrl+Enter saves from anywhere, textareas included.
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {/* The fast path, first. Pasting reads straight away — no button
                to find — and a typed link reads on Enter. */}
            <div className="space-y-2 rounded-lg border border-[var(--status-offer-text)]/30 bg-[var(--status-offer-soft)]/50 p-3">
              <Label
                htmlFor="quick-fill"
                className="flex items-center gap-1.5 text-sm font-medium text-[var(--status-offer-text)]"
              >
                <Sparkles className="h-4 w-4" />
                Fill from the job ad
              </Label>
              <Textarea
                id="quick-fill"
                rows={2}
                autoFocus
                placeholder="Paste a link to the job, or the whole ad"
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text");
                  if (!paste.trim() && text.trim()) {
                    e.preventDefault();
                    read(text);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                    if (!paste.includes("\n") && paste.trim()) {
                      e.preventDefault();
                      read(paste);
                    }
                  }
                }}
                className="min-h-[52px] resize-none bg-background"
              />
              {paste.trim() ? (
                <Button type="button" size="sm" onClick={() => read(paste)}>
                  <Wand2 className="h-4 w-4" /> Fill in the form
                </Button>
              ) : (
                !summary && (
                  <p className="text-xs text-muted-foreground">
                    We'll fill in the company, role, location, salary and requirements for you to
                    check — and keep a copy of the ad for when it's taken down.
                  </p>
                )
              )}

              {summary && (
                <div
                  role="status"
                  className="rounded-md border border-[var(--status-offer-text)]/40 bg-background p-2.5 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-[var(--status-offer-text)]">
                      {summary.some((s) => !s.warn)
                        ? "Here's what we read — check it before saving."
                        : "Nothing to fill from that — try pasting the whole ad."}
                    </p>
                    <div className="ml-auto flex shrink-0 items-center gap-1">
                      {undo && (
                        <button
                          type="button"
                          onClick={undoFill}
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                        >
                          <Undo2 className="h-3.5 w-3.5" /> Undo
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSummary(null)}
                        className="rounded p-0.5 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                        aria-label="Dismiss"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {summary.length > 0 && (
                    <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                      {summary.map((s) => (
                        <div key={s.label} className="contents">
                          <dt className="text-muted-foreground">{s.label}</dt>
                          <dd
                            className={cn(
                              "min-w-0 truncate",
                              s.warn ? "text-[var(--status-interviewing-text)]" : "font-medium",
                            )}
                          >
                            {s.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="company"
                label="Company"
                filled={filled.includes("company")}
                error={errors.company}
              >
                <Input
                  ref={companyRef}
                  id="company"
                  placeholder="Acme"
                  autoComplete="off"
                  maxLength={120}
                  value={draft.company}
                  onChange={(e) => edit("company", e.target.value)}
                  onBlur={() => needsWebsiteLookup(draft) && void lookUpWebsite(draft.company)}
                  aria-invalid={!!errors.company}
                  aria-describedby={errors.company ? "company-error" : undefined}
                  className={cn(filledClass("company"), errors.company && "border-destructive")}
                />
              </Field>
              <Field
                id="position"
                label="Position"
                filled={filled.includes("position")}
                error={errors.position}
              >
                <Input
                  ref={positionRef}
                  id="position"
                  placeholder="Product Designer"
                  autoComplete="off"
                  maxLength={120}
                  value={draft.position}
                  onChange={(e) => edit("position", e.target.value)}
                  aria-invalid={!!errors.position}
                  aria-describedby={errors.position ? "position-error" : undefined}
                  className={cn(filledClass("position"), errors.position && "border-destructive")}
                />
              </Field>
            </div>

            <Field
              id="website"
              label="Company website"
              filled={!!draft.websiteFrom}
              hint={websiteHint}
            >
              <div className="flex items-center gap-3">
                {draft.website.trim() ? (
                  <CompanyLogo
                    key={draft.website}
                    company={draft.company}
                    website={draft.website}
                  />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                    <Globe className="h-4 w-4" aria-hidden />
                  </span>
                )}
                <Input
                  id="website"
                  type="url"
                  inputMode="url"
                  placeholder="acme.com"
                  value={draft.website}
                  onChange={(e) => edit("website", e.target.value)}
                  className={cn(draft.websiteFrom && filledStyle)}
                />
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={draft.status} onValueChange={(v) => edit("status", v as Status)}>
                  <SelectTrigger id="status">
                    <SelectValue>{statusLabel(draft.status)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {statusLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="application_date">
                  {draft.status === "wishlist" ? "Saved on" : "Applied on"}
                </Label>
                <Input
                  id="application_date"
                  type="date"
                  value={draft.application_date}
                  onChange={(e) => edit("application_date", e.target.value)}
                />
              </div>
            </div>

            <LocationFields
              compact
              value={location}
              onChange={(v) => {
                setLocation(v);
                setLocationTouched(true);
              }}
            />

            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">More details</span>
                    <span className="block text-xs text-muted-foreground">
                      Job link, salary, requirements, notes and a follow-up task
                    </span>
                  </span>
                  {detailCount > 0 && (
                    <span className="shrink-0 rounded-full bg-[var(--status-offer-soft)] px-2 py-0.5 text-xs font-medium text-[var(--status-offer-text)]">
                      {detailCount} added
                    </span>
                  )}
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      detailsOpen && "rotate-180",
                    )}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-5 pt-5">
                <JobAdFields value={jobAd} onChange={setJobAd} showPaste={false} />

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    rows={3}
                    maxLength={2000}
                    placeholder="Who referred you, what stood out, anything to remember."
                    value={draft.notes}
                    onChange={(e) => edit("notes", e.target.value)}
                  />
                </div>

                <div className="space-y-3 rounded-lg border border-dashed p-4">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Follow-up task</p>
                    <p className="text-xs text-muted-foreground">
                      The next thing you owe this application — pick one or write your own.
                    </p>
                  </div>
                  {followUps.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {followUps.map((f) => {
                        const due = isoDate(addDays(new Date(), f.days));
                        const active = draft.task_title === f.title && draft.task_due_date === due;
                        return (
                          <button
                            key={`${f.title}-${f.days}`}
                            type="button"
                            aria-pressed={active}
                            onClick={() => {
                              edit("task_title", active ? "" : f.title);
                              edit("task_due_date", active ? "" : due);
                            }}
                            className={cn(
                              "rounded-full border px-3 py-1 text-xs transition-colors",
                              active
                                ? "border-foreground bg-foreground text-background"
                                : "text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                            )}
                          >
                            {f.title} · {inDays(f.days)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
                    <div className="space-y-2">
                      <Label htmlFor="task_title">Task</Label>
                      <Input
                        id="task_title"
                        placeholder="e.g. Send follow-up email"
                        maxLength={200}
                        value={draft.task_title}
                        onChange={(e) => edit("task_title", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="task_due_date">Due</Label>
                      <Input
                        id="task_due_date"
                        type="date"
                        value={draft.task_due_date}
                        onChange={(e) => edit("task_due_date", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <DialogFooter className="shrink-0 flex-row items-center gap-2 border-t px-6 py-4 sm:justify-between sm:space-x-0">
            <div className="flex min-w-0 items-center gap-3">
              {dirty && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-2 text-muted-foreground"
                  onClick={reset}
                >
                  Clear form
                </Button>
              )}
              <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                <kbd className="rounded border bg-muted px-1 font-sans">{isMac ? "⌘" : "Ctrl"}</kbd>
                <kbd className="rounded border bg-muted px-1 font-sans">
                  <CornerDownLeft className="h-3 w-3" />
                </kbd>
                to save
              </span>
            </div>
            <Button type="submit" className="ml-auto" disabled={isPending}>
              {isPending ? "Saving…" : "Add application"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A labelled field with the "filled from the ad" mark, an inline error and a hint. */
function Field({
  id,
  label,
  filled,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  filled?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-1.5">
        {label}
        {filled && (
          <span
            className="flex items-center gap-0.5 text-xs font-normal text-[var(--status-offer-text)]"
            title="Filled from what you pasted — check it"
          >
            <Sparkles className="h-3 w-3" />
            <span>filled in</span>
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
