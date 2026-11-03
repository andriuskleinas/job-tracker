import { useMemo, useState, type ReactNode } from "react";
import { Blend, Building2, Globe, Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { BOARD_COLUMNS, CLOSED_STATUSES, statusFill, statusLabel, type Status } from "@/lib/status";
import { flagForCountry, JOB_TYPE_META, type JobType } from "@/lib/job-location";
import {
  availableCities,
  availableCountries,
  availableJobTypes,
  filterApplications,
  hasActiveFilters,
  type ApplicationFilters as Filters,
} from "@/lib/application-filters";
import type { ApplicationCardData } from "@/components/ApplicationCard";
import { cn } from "@/lib/utils";

/** The search box's id, so the page's `/` shortcut can focus it. */
export const SEARCH_INPUT_ID = "applications-search";

const JOB_TYPE_ICON: Record<JobType, typeof Globe> = {
  remote: Globe,
  hybrid: Blend,
  onsite: Building2,
};

/**
 * The pipeline as a row of tabs, each with its count — the one filter people
 * reach for constantly, so it is always on screen rather than inside a menu,
 * and the counts double as an at-a-glance summary of where the search stands.
 *
 * Only the live statuses get a tab; rejected and withdrawn have their own home
 * in the archive below. Counts honour every other active filter, so a number
 * always says exactly what clicking it will show.
 */
function StatusTabs({
  apps,
  value,
  onChange,
}: {
  apps: ApplicationCardData[];
  value: Filters;
  onChange: (status: Status[]) => void;
}) {
  const counts = useMemo(() => {
    const live = filterApplications(apps, { ...value, status: [] }).filter(
      (a) => !CLOSED_STATUSES.includes(a.status),
    );
    const by = new Map<Status | "all", number>([["all", live.length]]);
    for (const a of live) by.set(a.status, (by.get(a.status) ?? 0) + 1);
    return by;
  }, [apps, value]);

  // A hand-edited URL can hold several statuses at once; then no tab is lit.
  const active =
    value.status.length === 0 ? "all" : value.status.length === 1 ? value.status[0] : null;
  const tabs: (Status | "all")[] = ["all", ...BOARD_COLUMNS];

  return (
    <div
      role="group"
      aria-label="Filter by status"
      className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]"
    >
      {tabs.map((tab) => {
        const selected = active === tab;
        const count = counts.get(tab) ?? 0;
        return (
          <button
            key={tab}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(tab === "all" ? [] : [tab])}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
              selected
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              !selected && count === 0 && "opacity-60",
            )}
          >
            {tab !== "all" && (
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{ background: statusFill[tab] }}
              />
            )}
            {tab === "all" ? "All" : statusLabel(tab)}
            <span className={cn("text-xs tabular-nums", selected ? "opacity-70" : "opacity-60")}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** A labelled block inside the Filters popover or sheet. */
function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/**
 * The applications toolbar: status tabs, search, and everything else behind
 * one Filters button.
 *
 * Job type, country and city used to sit inline as three more controls, so
 * the bar read as a form to fill in before seeing anything. They are used far
 * less than status and search, so they now live in a popover (a bottom sheet
 * on phones) and show up as removable chips once set — out of the way until
 * wanted, impossible to forget once applied.
 *
 * Fully controlled — the route owns the filter state (mirrored in the URL) and
 * passes down a single patch callback.
 */
export function ApplicationFilters({
  apps,
  value,
  onChange,
  onClear,
  resultCount,
  showStatusTabs = true,
}: {
  apps: ApplicationCardData[];
  value: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
  resultCount: number;
  /** Off on the board, whose columns already are the statuses. */
  showStatusTabs?: boolean;
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

  const hasJobTypes = jobTypeOptions.length > 0;
  const hasCountries = countryOptions.length > 1;
  const hasCities = cityOptions.length > 1;
  const hasMoreFilters = hasJobTypes || hasCountries || hasCities;
  const moreCount = value.jobType.length + (value.country ? 1 : 0) + (value.city ? 1 : 0);
  const clearMore = () => onChange({ jobType: [], country: "", city: "" });

  const toggleJobType = (t: JobType) =>
    onChange({
      jobType: value.jobType.includes(t)
        ? value.jobType.filter((x) => x !== t)
        : [...value.jobType, t],
    });

  const fields = (
    <>
      {hasJobTypes && (
        <FilterField label="Job type">
          <div className="flex flex-wrap gap-1.5">
            {jobTypeOptions.map((t) => {
              const Icon = JOB_TYPE_ICON[t];
              const on = value.jobType.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleJobType(t)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
                    on
                      ? "border-foreground bg-foreground text-background"
                      : "text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {JOB_TYPE_META[t].short}
                </button>
              );
            })}
          </div>
        </FilterField>
      )}
      {hasCountries && (
        <FilterField label="Country">
          <Combobox
            options={countryOptions}
            value={value.country}
            onSelect={(country) => onChange({ country, city: "" })}
            placeholder="Any country"
            searchPlaceholder="Search countries…"
            triggerIcon={
              value.country && flagForCountry(value.country) ? (
                <span aria-hidden>{flagForCountry(value.country)}</span>
              ) : undefined
            }
          />
        </FilterField>
      )}
      {hasCities && (
        <FilterField label="City">
          <Combobox
            options={cityOptions}
            value={value.city}
            onSelect={(city) => onChange({ city })}
            placeholder="Any city"
            searchPlaceholder="Search cities…"
          />
        </FilterField>
      )}
    </>
  );

  const triggerContent = (
    <>
      <SlidersHorizontal className="h-4 w-4 opacity-70" />
      Filters
      {moreCount > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-xs font-medium tabular-nums text-background">
          {moreCount}
        </span>
      )}
    </>
  );

  // Every narrowing that isn't visible elsewhere on the bar, as a chip that
  // undoes itself.
  const chips: { key: string; name: string; label: ReactNode; clear: () => void }[] = [
    ...value.jobType.map((t) => ({
      key: `type-${t}`,
      name: JOB_TYPE_META[t].short,
      label: JOB_TYPE_META[t].short,
      clear: () => toggleJobType(t),
    })),
    ...(value.country
      ? [
          {
            key: "country",
            name: value.country,
            label: (
              <>
                {flagForCountry(value.country) && (
                  <span aria-hidden>{flagForCountry(value.country)}</span>
                )}
                {value.country}
              </>
            ),
            clear: () => onChange({ country: "", city: "" }),
          },
        ]
      : []),
    ...(value.city
      ? [{ key: "city", name: value.city, label: value.city, clear: () => onChange({ city: "" }) }]
      : []),
  ];

  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {showStatusTabs && (
          <StatusTabs apps={apps} value={value} onChange={(status) => onChange({ status })} />
        )}

        <div className="flex items-center gap-2 lg:ml-auto">
          <div className="relative min-w-0 flex-1 lg:w-64 lg:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={SEARCH_INPUT_ID}
              type="search"
              value={value.q}
              onChange={(e) => onChange({ q: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  onChange({ q: "" });
                  e.currentTarget.blur();
                }
              }}
              placeholder="Search company or role…"
              aria-label="Search applications"
              aria-keyshortcuts="/"
              className="pl-9 pr-8"
            />
            {!value.q && (
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border bg-muted px-1.5 font-sans text-[11px] text-muted-foreground sm:block">
                /
              </kbd>
            )}
          </div>

          {hasMoreFilters && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="hidden h-9 gap-2 font-normal sm:inline-flex">
                    {triggerContent}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 space-y-4 p-4">
                  {fields}
                  {moreCount > 0 && (
                    <button
                      type="button"
                      onClick={clearMore}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" /> Clear these filters
                    </button>
                  )}
                </PopoverContent>
              </Popover>

              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="h-9 gap-2 font-normal sm:hidden">
                    {triggerContent}
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="flex max-h-[85vh] flex-col rounded-t-xl p-0">
                  <SheetHeader className="px-6 pt-6 text-left">
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">{fields}</div>
                  {/* Pinned footer: Clear / Show-results stay reachable no
                      matter how tall the control stack grows. */}
                  <SheetFooter className="flex-row gap-2 border-t px-6 py-3">
                    <Button
                      variant="ghost"
                      onClick={clearMore}
                      disabled={moreCount === 0}
                      className="flex-1 text-muted-foreground"
                    >
                      Clear
                    </Button>
                    <SheetClose asChild>
                      <Button className="flex-1">Show {resultCount} results</Button>
                    </SheetClose>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
            </>
          )}
        </div>
      </div>

      {(chips.length > 0 || (hasActiveFilters(value) && value.q.trim())) && (
        <div className="flex flex-wrap items-center gap-1.5" aria-live="polite">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.clear}
              aria-label={`Remove filter: ${c.name}`}
              className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs transition-colors hover:border-foreground/30"
            >
              {c.label}
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          ))}
          <span className="px-1 text-xs text-muted-foreground">
            {resultCount} result{resultCount === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
