import { useState, type ReactNode } from "react";
import { useMemo } from "react";
import { Blend, Building2, Globe, ListFilter, Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox, type ComboboxOption } from "@/components/Combobox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { statusColor } from "@/lib/status";
import { flagForCountry, JOB_TYPE_META, type JobType } from "@/lib/job-location";
import {
  activeFilterCount,
  availableCities,
  availableCountries,
  availableJobTypes,
  hasActiveFilters,
  STATUS_ORDER,
  type ApplicationFilters as Filters,
} from "@/lib/application-filters";
import type { ApplicationCardData } from "@/components/ApplicationCard";
import { cn } from "@/lib/utils";

/** Multi-select status control: a popover of coloured checkboxes. Five states,
 * so no search — just tap the ones you want. The trigger carries a count.
 * `fullWidth` stretches it for the stacked mobile sheet. */
function StatusFilter({
  value,
  onChange,
  fullWidth,
}: {
  value: Filters["status"];
  onChange: (next: Filters["status"]) => void;
  fullWidth?: boolean;
}) {
  const toggle = (s: (typeof STATUS_ORDER)[number]) =>
    onChange(value.includes(s) ? value.filter((x) => x !== s) : [...value, s]);

  const label =
    value.length === 0 ? "Status" : value.length === 1 ? value[0] : `${value.length} statuses`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 gap-2 font-normal",
            // Inline: hug the label like a chip. Stacked (mobile sheet):
            // full width with the count pushed to the right edge.
            fullWidth ? "w-full justify-between" : "",
            value.length > 0 && "border-brand/50",
          )}
        >
          <span
            className={cn(
              "flex items-center gap-2 truncate",
              value.length === 0 && "text-muted-foreground",
            )}
          >
            <ListFilter className="h-4 w-4 shrink-0 opacity-60" />
            <span className="truncate capitalize">{label}</span>
          </span>
          {value.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand/15 px-1.5 text-xs font-medium tabular-nums text-brand-accent">
              {value.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1.5">
        {STATUS_ORDER.map((s) => {
          const checked = value.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              className="flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            >
              <Checkbox checked={checked} tabIndex={-1} className="pointer-events-none" />
              <span
                className={cn(
                  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize",
                  statusColor[s],
                )}
              >
                {s}
              </span>
            </button>
          );
        })}
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="mt-1 flex w-full items-center gap-1.5 border-t px-2 pb-1 pt-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> Clear statuses
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

const JOB_TYPE_ICON: Record<JobType, typeof Globe> = {
  remote: Globe,
  hybrid: Blend,
  onsite: Building2,
};

/** Multi-select job-type control, mirroring {@link StatusFilter}. Only the
 * types present in the data are offered, each with its board icon + label. */
function JobTypeFilter({
  options,
  value,
  onChange,
  fullWidth,
}: {
  options: JobType[];
  value: Filters["jobType"];
  onChange: (next: Filters["jobType"]) => void;
  fullWidth?: boolean;
}) {
  const toggle = (t: JobType) =>
    onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);

  const label =
    value.length === 0
      ? "Job type"
      : value.length === 1
        ? JOB_TYPE_META[value[0]].short
        : `${value.length} types`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 gap-2 font-normal",
            fullWidth ? "w-full justify-between" : "",
            value.length > 0 && "border-brand/50",
          )}
        >
          <span
            className={cn(
              "flex items-center gap-2 truncate",
              value.length === 0 && "text-muted-foreground",
            )}
          >
            <Globe className="h-4 w-4 shrink-0 opacity-60" />
            <span className="truncate">{label}</span>
          </span>
          {value.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand/15 px-1.5 text-xs font-medium tabular-nums text-brand-accent">
              {value.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1.5">
        {options.map((t) => {
          const checked = value.includes(t);
          const Icon = JOB_TYPE_ICON[t];
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggle(t)}
              className="flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            >
              <Checkbox checked={checked} tabIndex={-1} className="pointer-events-none" />
              <Icon className="h-4 w-4 text-muted-foreground" />
              {JOB_TYPE_META[t].label}
            </button>
          );
        })}
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="mt-1 flex w-full items-center gap-1.5 border-t px-2 pb-1 pt-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> Clear job types
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * One filter control plus, in the stacked mobile sheet, a small label above it.
 *
 * `desktopWidth` sizes the inline (non-stacked) wrapper: comboboxes need a
 * stable width so they don't jump when a long value is picked; the hug-content
 * pills pass "" so their wrapper shrinks to the pill and no empty space is left
 * masquerading as a gap. In the sheet every control is full width regardless.
 */
function Field({
  label,
  stacked,
  desktopWidth = "sm:w-52",
  children,
}: {
  label: string;
  stacked: boolean;
  desktopWidth?: string;
  children: ReactNode;
}) {
  if (!stacked) return <div className={desktopWidth || undefined}>{children}</div>;
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/**
 * The applications board filter toolbar. Keyword search, multi-select status,
 * and company/country/city pickers scoped to values that actually exist in the
 * data. Fully controlled — the route owns the filter state (mirrored in the
 * URL) and passes down a single patch callback.
 *
 * Responsive by the hybrid pattern: on desktop every control sits inline (the
 * `hidden sm:contents` wrapper lets them flow as direct flex children); on
 * mobile they collapse behind a single "Filters" button that opens a bottom
 * sheet, so a narrow screen isn't dominated by a tall stack of controls.
 */
export function ApplicationFilters({
  apps,
  value,
  onChange,
  onClear,
  resultCount,
}: {
  apps: ApplicationCardData[];
  value: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
  resultCount: number;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const countryOptions = useMemo<ComboboxOption[]>(() => {
    const opts = availableCountries(apps).map((name) => ({
      value: name,
      label: name,
      icon: flagForCountry(name) ? <span aria-hidden>{flagForCountry(name)}</span> : undefined,
    }));
    return [{ value: "", label: "Any country" }, ...opts];
  }, [apps]);

  const cityOptions = useMemo<ComboboxOption[]>(() => {
    const opts = availableCities(apps, value.country).map(({ city, country }) => ({
      value: city,
      label: city,
      hint: country || undefined,
      keywords: `${city} ${country}`,
    }));
    return [{ value: "", label: "Any city" }, ...opts];
  }, [apps, value.country]);

  const jobTypeOptions = useMemo(() => availableJobTypes(apps), [apps]);

  const active = hasActiveFilters(value);
  const total = apps.length;
  const hasJobTypes = jobTypeOptions.length > 0;
  const hasCountries = countryOptions.length > 1;
  const hasCities = cityOptions.length > 1;

  // Search sits outside the sheet (always visible), so the sheet's own badge
  // counts only the controls it holds.
  const sheetCount = activeFilterCount(value) - (value.q.trim() ? 1 : 0);

  // The status + company/country/city controls, shared by the desktop inline
  // row and the mobile sheet. `stacked` switches to full-width labelled fields.
  const fields = (stacked: boolean) => (
    <>
      <Field label="Status" stacked={stacked} desktopWidth="">
        <StatusFilter
          value={value.status}
          onChange={(status) => onChange({ status })}
          fullWidth={stacked}
        />
      </Field>

      {hasJobTypes && (
        <Field label="Job type" stacked={stacked} desktopWidth="">
          <JobTypeFilter
            options={jobTypeOptions}
            value={value.jobType}
            onChange={(jobType) => onChange({ jobType })}
            fullWidth={stacked}
          />
        </Field>
      )}

      {hasCountries && (
        <Field label="Country" stacked={stacked}>
          <Combobox
            options={countryOptions}
            value={value.country}
            onSelect={(country) => onChange({ country, city: "" })}
            placeholder="Country"
            searchPlaceholder="Search countries…"
            triggerIcon={
              value.country && flagForCountry(value.country) ? (
                <span aria-hidden>{flagForCountry(value.country)}</span>
              ) : undefined
            }
          />
        </Field>
      )}

      {hasCities && (
        <Field label="City" stacked={stacked}>
          <Combobox
            options={cityOptions}
            value={value.city}
            onSelect={(city) => onChange({ city })}
            placeholder="City"
            searchPlaceholder="Search cities…"
          />
        </Field>
      )}
    </>
  );

  return (
    <div className="mb-5 space-y-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {/* Search — always visible, at both sizes. Grows to fill but capped
            so the bar reads as a tidy left-packed row, not one giant field. */}
        <div className="relative sm:min-w-56 sm:max-w-sm sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={value.q}
            onChange={(e) => onChange({ q: e.target.value })}
            placeholder="Search company or role…"
            aria-label="Search applications"
            className="pl-9"
          />
        </div>

        {/* Desktop: controls flow inline (contents = no wrapper box). */}
        <div className="hidden sm:contents">
          {fields(false)}
          {active && (
            <Button variant="ghost" onClick={onClear} className="h-9 text-muted-foreground">
              <X className="h-4 w-4" /> Clear
              <span className="ml-0.5 rounded-full bg-muted px-1.5 text-xs tabular-nums">
                {activeFilterCount(value)}
              </span>
            </Button>
          )}
        </div>

        {/* Mobile: one Filters button that opens a bottom sheet. */}
        <div className="sm:hidden">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-full justify-center gap-2", sheetCount > 0 && "border-brand/50")}
              >
                <SlidersHorizontal className="h-4 w-4 opacity-70" />
                Filters
                {sheetCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand/15 px-1.5 text-xs font-medium tabular-nums text-brand-accent">
                    {sheetCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="flex max-h-[85vh] flex-col rounded-t-xl p-0">
              <SheetHeader className="px-6 pt-6 text-left">
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">{fields(true)}</div>
              {/* Pinned footer: Clear / Show-results stay reachable no matter
                  how tall the control stack grows. */}
              <SheetFooter className="flex-row gap-2 border-t px-6 py-3">
                <Button
                  variant="ghost"
                  onClick={onClear}
                  disabled={!active}
                  className="flex-1 text-muted-foreground"
                >
                  Clear all
                </Button>
                <SheetClose asChild>
                  <Button className="flex-1">Show {resultCount} results</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {active && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Showing <span className="font-medium tabular-nums text-foreground">{resultCount}</span> of{" "}
          <span className="tabular-nums">{total}</span> application{total === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}
