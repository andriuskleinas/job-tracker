import { useState } from "react";
import { Building2, Blend, Check, ChevronsUpDown, Globe, MapPin } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  CITIES,
  COUNTRIES,
  JOB_TYPES,
  JOB_TYPE_META,
  type JobType,
  flagEmoji,
  flagForCountry,
} from "@/lib/job-location";

export type LocationValue = {
  job_type: JobType | "";
  country: string;
  city: string;
};

const JOB_TYPE_ICON: Record<JobType, typeof Globe> = {
  remote: Globe,
  hybrid: Blend,
  onsite: Building2,
};

/**
 * Job type + location block shared by the New application dialog and the edit
 * page. Fully controlled: it owns no persistence, just surfaces changes.
 *
 * The city picker leads — choosing a city sets its country automatically — and
 * a required marker appears on city/country only when the job type needs a
 * base (hybrid or on-site). Remote roles keep both fields optional.
 */
export function LocationFields({
  value,
  onChange,
}: {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
}) {
  const required = value.job_type ? JOB_TYPE_META[value.job_type].locationRequired : false;

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <Label>Job type</Label>
        <div className="grid grid-cols-3 gap-2">
          {JOB_TYPES.map((jt) => {
            const Icon = JOB_TYPE_ICON[jt];
            const active = value.job_type === jt;
            return (
              <button
                key={jt}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ ...value, job_type: jt })}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-md border p-3 text-center transition-colors",
                  active
                    ? "border-foreground bg-foreground text-background shadow-sm"
                    : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium leading-tight">{JOB_TYPE_META[jt].short}</span>
              </button>
            );
          })}
        </div>
        {value.job_type && (
          <p className="text-xs text-muted-foreground">{JOB_TYPE_META[value.job_type].hint}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>
            City{" "}
            {required ? (
              <span className="text-brand-accent">*</span>
            ) : (
              <span className="font-normal text-muted-foreground">(optional)</span>
            )}
          </Label>
          <CityCombobox
            value={value.city}
            onSelectCity={(city, country) => onChange({ ...value, city, country })}
            onCustom={(city) => onChange({ ...value, city })}
          />
        </div>
        <div className="space-y-2">
          <Label>
            Country{" "}
            {required ? (
              <span className="text-brand-accent">*</span>
            ) : (
              <span className="font-normal text-muted-foreground">(optional)</span>
            )}
          </Label>
          <CountryCombobox
            value={value.country}
            onSelect={(country) => onChange({ ...value, country })}
          />
        </div>
      </div>
    </div>
  );
}

function TriggerButton({
  children,
  placeholder,
  filled,
}: {
  children: React.ReactNode;
  placeholder: string;
  filled: boolean;
}) {
  return (
    <button
      type="button"
      role="combobox"
      className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      <span className={cn("flex min-w-0 items-center gap-1.5", !filled && "text-muted-foreground")}>
        {children ?? placeholder}
      </span>
      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
    </button>
  );
}

function CityCombobox({
  value,
  onSelectCity,
  onCustom,
}: {
  value: string;
  onSelectCity: (city: string, country: string) => void;
  onCustom: (city: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const known = CITIES.some((c) => c.city.toLowerCase() === trimmed.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <TriggerButton placeholder="Search a city…" filled={!!value}>
          {value ? (
            <>
              <MapPin className="h-4 w-4 shrink-0 opacity-70" />
              <span className="truncate">{value}</span>
            </>
          ) : (
            "Search a city…"
          )}
        </TriggerButton>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Type a city…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>
              {trimmed ? (
                <button
                  type="button"
                  className="mx-auto block w-full px-2 py-1.5 text-sm hover:underline"
                  onClick={() => {
                    onCustom(trimmed);
                    setOpen(false);
                  }}
                >
                  Use “{trimmed}”
                </button>
              ) : (
                "No city found."
              )}
            </CommandEmpty>
            <CommandGroup>
              {CITIES.map((c) => (
                <CommandItem
                  key={`${c.city}-${c.code}`}
                  value={`${c.city} ${c.country}`}
                  onSelect={() => {
                    onSelectCity(c.city, c.country);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value === c.city ? "opacity-100" : "opacity-0")}
                  />
                  <span className="mr-2">{flagEmoji(c.code)}</span>
                  <span className="flex-1">{c.city}</span>
                  <span className="text-xs text-muted-foreground">{c.country}</span>
                </CommandItem>
              ))}
              {trimmed && !known && (
                <CommandItem
                  value={`use-custom-${trimmed}`}
                  onSelect={() => {
                    onCustom(trimmed);
                    setOpen(false);
                  }}
                >
                  <MapPin className="mr-2 h-4 w-4 opacity-70" />
                  Use “{trimmed}”
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function CountryCombobox({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (country: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <TriggerButton placeholder="Select a country…" filled={!!value}>
          {value ? (
            <>
              <span className="shrink-0">{flagForCountry(value) || "🌐"}</span>
              <span className="truncate">{value}</span>
            </>
          ) : (
            "Select a country…"
          )}
        </TriggerButton>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Type a country…" />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {COUNTRIES.map((c) => (
                <CommandItem
                  key={c.code}
                  value={c.name}
                  onSelect={() => {
                    onSelect(c.name);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value === c.name ? "opacity-100" : "opacity-0")}
                  />
                  <span className="mr-2">{flagEmoji(c.code)}</span>
                  {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
