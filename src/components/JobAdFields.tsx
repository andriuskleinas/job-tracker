import { useState } from "react";
import { ClipboardPaste, Link2, Sparkles, Wand2, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  CURRENCY_CODES,
  SALARY_PERIODS,
  SALARY_PERIOD_META,
  SALARY_SOURCES,
  SALARY_SOURCE_META,
  formatSalary,
  parseJobAd,
} from "@/lib/job-ad";
import { MAX_AD_LENGTH, type JobAdValue } from "@/lib/job-ad-form";

const NONE = "__none__";

/**
 * Capture the job ad: paste it, check what was read out of it, correct
 * anything wrong.
 *
 * The parse never writes silently — everything it finds lands in a visible,
 * editable field and the block says what it did. A wrong salary the user never
 * saw is worse than an empty one, because they act on it months later when the
 * posting is gone and there is nothing left to check it against.
 */
export function JobAdFields({
  value,
  onChange,
  capturedAt,
}: {
  value: JobAdValue;
  onChange: (v: JobAdValue) => void;
  capturedAt?: string | null;
}) {
  const [paste, setPaste] = useState("");
  const [found, setFound] = useState<{ salary: string | null; requirements: boolean } | null>(null);

  const salaryPreview = formatSalary({
    salary_min: value.salary_min ? Number(value.salary_min) : null,
    salary_max: value.salary_max ? Number(value.salary_max) : null,
    salary_currency: value.salary_currency || null,
    salary_period: (value.salary_period || null) as never,
  });

  const readAd = () => {
    const raw = paste.trim();
    if (!raw) return;
    if (raw.length > MAX_AD_LENGTH) {
      toast.error(
        `That's ${Math.round(raw.length / 1000)}k characters — paste just the job ad, up to ${MAX_AD_LENGTH / 1000}k.`,
      );
      return;
    }

    const parsed = parseJobAd(raw);
    const next: JobAdValue = { ...value, description: parsed.description };
    if (parsed.requirements) next.requirements = parsed.requirements;
    if (parsed.salary) {
      next.salary_min = parsed.salary.salary_min?.toString() ?? "";
      next.salary_max = parsed.salary.salary_max?.toString() ?? "";
      next.salary_currency = parsed.salary.salary_currency ?? "";
      next.salary_period = parsed.salary.salary_period ?? "";
      // The ad said it, so that is where the number came from.
      next.salary_source = value.salary_source || "posted";
    }
    onChange(next);

    const salaryLabel = parsed.salary ? formatSalary(parsed.salary) : null;
    setFound({ salary: salaryLabel, requirements: !!parsed.requirements });
    setPaste("");

    if (salaryLabel && parsed.salary?.confidence === "low") {
      toast.warning(`Read a salary of ${salaryLabel} — worth checking, the ad was vague.`);
    } else if (salaryLabel) {
      toast.success(`Ad saved. Found a salary of ${salaryLabel}.`);
    } else {
      toast.success("Ad saved. No salary found in it — add one below if you know it.");
    }
  };

  const set = (patch: Partial<JobAdValue>) => onChange({ ...value, ...patch });

  const clearSalary = () =>
    set({ salary_min: "", salary_max: "", salary_currency: "", salary_period: "" });

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-sm font-medium">The role</Label>
        {capturedAt && (
          <span className="text-xs text-muted-foreground">
            Ad captured{" "}
            {new Date(capturedAt).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        )}
      </div>

      {/* Paste first: this is the fast path through the form, not an extra step
          after it. Filling it is quicker than typing the fields below. */}
      <div className="space-y-2">
        <Label htmlFor="job-ad-paste" className="flex items-center gap-2 text-xs font-normal">
          <ClipboardPaste className="h-3.5 w-3.5" />
          Paste the job ad
        </Label>
        <Textarea
          id="job-ad-paste"
          rows={3}
          placeholder="Paste the whole posting here — we'll pull out the salary and requirements, and keep a copy for when the ad is taken down."
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!paste.trim()}
            onClick={readAd}
          >
            <Wand2 className="h-4 w-4" /> Read the ad
          </Button>
          <p className="text-xs text-muted-foreground">
            Company and job title stay yours to fill in — we don't guess those.
          </p>
        </div>

        {found && (
          <div className="flex items-start gap-2 rounded-md border border-[var(--status-offer-text)]/40 bg-[var(--status-offer-soft)] p-2.5 text-xs">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--status-offer-text)]" />
            <div className="space-y-0.5 text-[var(--status-offer-text)]">
              <p className="font-medium">Read from the ad — check it below.</p>
              <p>
                {found.salary ? `Salary ${found.salary}. ` : "No salary found. "}
                {found.requirements
                  ? "Requirements section found."
                  : "No requirements section found."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFound(null)}
              className="ml-auto shrink-0 rounded p-0.5 text-[var(--status-offer-text)] hover:bg-foreground/5"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="job_url" className="flex items-center gap-2">
          <Link2 className="h-3.5 w-3.5" />
          Link to the job ad
        </Label>
        <Input
          id="job_url"
          type="url"
          inputMode="url"
          placeholder="https://boards.greenhouse.io/acme/jobs/12345"
          value={value.job_url}
          onChange={(e) => set({ job_url: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          The page you applied on — often the company's own board rather than where you found it.
        </p>
      </div>

      {/* Salary */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>Salary range</Label>
          {salaryPreview && (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{salaryPreview}</span>
              <button
                type="button"
                onClick={clearSalary}
                className="underline underline-offset-2 hover:text-foreground"
              >
                Clear
              </button>
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Input
            aria-label="Salary minimum"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            placeholder="From"
            value={value.salary_min}
            onChange={(e) => set({ salary_min: e.target.value })}
          />
          <Input
            aria-label="Salary maximum"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            placeholder="To"
            value={value.salary_max}
            onChange={(e) => set({ salary_max: e.target.value })}
          />
          <Select
            value={value.salary_currency || NONE}
            onValueChange={(v) => set({ salary_currency: v === NONE ? "" : v })}
          >
            <SelectTrigger aria-label="Currency">
              <SelectValue placeholder="Currency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Currency</SelectItem>
              {CURRENCY_CODES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={value.salary_period || NONE}
            onValueChange={(v) => set({ salary_period: v === NONE ? "" : v })}
          >
            <SelectTrigger aria-label="Salary period">
              <SelectValue placeholder="Per…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Per…</SelectItem>
              {SALARY_PERIODS.map((p) => (
                <SelectItem key={p} value={p}>
                  {SALARY_PERIOD_META[p].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Select
          value={value.salary_source || NONE}
          onValueChange={(v) => set({ salary_source: v === NONE ? "" : v })}
        >
          <SelectTrigger aria-label="Where the salary came from">
            <SelectValue placeholder="Where did this number come from?" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Where did this number come from?</SelectItem>
            {SALARY_SOURCES.map((s) => (
              <SelectItem key={s} value={s}>
                {SALARY_SOURCE_META[s].label} — {SALARY_SOURCE_META[s].hint}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="requirements">Requirements</Label>
        <Textarea
          id="requirements"
          rows={4}
          placeholder="What the role asks for — the list you'll want the night before the interview."
          value={value.requirements}
          onChange={(e) => set({ requirements: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Job description</Label>
        <Textarea
          id="description"
          rows={6}
          placeholder="The full ad. Kept verbatim, so it survives the posting being taken down."
          value={value.description}
          onChange={(e) => set({ description: e.target.value })}
        />
        {value.description.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {value.description.length.toLocaleString()} characters saved.
          </p>
        )}
      </div>
    </div>
  );
}
