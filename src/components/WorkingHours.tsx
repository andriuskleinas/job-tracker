import { useEffect, useState } from "react";
import { Clock3, Globe2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/Combobox";
import { useUserZone } from "@/hooks/use-user-zone";
import {
  WORKDAY,
  describeOverlap,
  formatHour,
  formatOffset,
  offsetBetween,
  timeInZone,
  workdayOverlap,
  zoneForApplication,
} from "@/lib/time-zone";

/** IANA zones the browser knows about, with a fallback for older engines. */
function zoneOptions() {
  const supported =
    typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : null;
  const zones = supported ?? ["UTC", "Europe/London", "America/New_York", "America/Los_Angeles"];
  return zones.map((z) => ({
    value: z,
    label: z.replace(/_/g, " "),
    keywords: z.replace(/[/_]/g, " "),
  }));
}

/** The shared band drawn against a 24-hour rail, both days marked. */
function OverlapBar({ offsetMinutes }: { offsetMinutes: number }) {
  const overlap = workdayOverlap(offsetMinutes);
  const pct = (hour: number) => `${(hour / 24) * 100}%`;

  return (
    <div className="space-y-1.5">
      <div className="relative h-7 overflow-hidden rounded-md border bg-muted/40">
        {/* Your working day */}
        <div
          className="absolute inset-y-0 bg-foreground/15"
          style={{ left: pct(WORKDAY.start), width: pct(WORKDAY.end - WORKDAY.start) }}
        />
        {/* The shared window, drawn on top */}
        {overlap.yourStart !== null && overlap.yourEnd !== null && (
          <div
            className="absolute inset-y-0 bg-[var(--status-offer)]/45"
            style={{
              left: pct(overlap.yourStart),
              width: pct(overlap.yourEnd - overlap.yourStart),
            }}
          />
        )}
        {[6, 12, 18].map((h) => (
          <div key={h} className="absolute inset-y-0 w-px bg-border" style={{ left: pct(h) }} />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>
    </div>
  );
}

/**
 * Where a role sits in time, relative to you.
 *
 * The offset alone is a number, not an answer — the decision underneath it is
 * always whether a call can happen at all, so the overlap window leads and the
 * raw difference supports it. The zone is derived from the role's city or
 * country, and can be set outright for remote roles where no location implies
 * the hours anyone actually works.
 */
export function WorkingHours({
  app,
  value,
  onChange,
}: {
  app: { city: string | null; country: string | null };
  value: string;
  onChange: (zone: string) => void;
}) {
  const userZone = useUserZone();
  const [now, setNow] = useState(() => new Date());

  // Their clock should be right, not right-when-the-page-loaded.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const zone = zoneForApplication({ ...app, time_zone: value });
  const offset = zone && userZone ? offsetBetween(zone, userZone, now) : null;

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-sm font-medium">Working hours</Label>
        {zone && offset !== null && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
            <Clock3 className="h-3.5 w-3.5" />
            {timeInZone(zone, now)} there · {formatOffset(offset)}
          </span>
        )}
      </div>

      {zone && offset !== null ? (
        <>
          <OverlapBar offsetMinutes={offset} />
          <p className="text-sm">{describeOverlap(workdayOverlap(offset))}</p>
          <p className="text-xs text-muted-foreground">
            Against a {formatHour(WORKDAY.start)}–{formatHour(WORKDAY.end)} day in {zone} and yours
            in {userZone}.
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {userZone
            ? "No location on this role yet — add a city, or set the zone below."
            : "Working out your time zone…"}
        </p>
      )}

      <div className="space-y-2">
        <Label className="text-xs font-normal">Time zone</Label>
        <Combobox
          options={zoneOptions()}
          value={value}
          onSelect={onChange}
          placeholder={zone && !value ? `From the location — ${zone}` : "Set a zone for this role…"}
          searchPlaceholder="Type a zone or city…"
          emptyText="No time zone found."
          triggerIcon={<Globe2 className="h-4 w-4 shrink-0 opacity-70" />}
        />
        <p className="text-xs text-muted-foreground">
          Only needed when the location doesn't tell the whole story — a remote role that still has
          to overlap with one office, say.
        </p>
      </div>
    </div>
  );
}
