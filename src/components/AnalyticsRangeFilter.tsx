import { useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export const RANGE_PRESETS = ["all", "7d", "14d", "30d", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];
type QuickPreset = Exclude<RangePreset, "custom">;

const QUICK_PRESETS: readonly QuickPreset[] = ["all", "7d", "14d", "30d"];
const PRESET_LABEL: Record<QuickPreset, string> = {
  all: "All time",
  "7d": "7 days",
  "14d": "14 days",
  "30d": "30 days",
};

/**
 * The one control that decides what every number on the page means: five
 * presets as a segmented toggle, matching the list/grid/board pattern the
 * applications page already uses for the same kind of choice, plus a custom
 * range that opens a two-month calendar rather than crowding a sixth toggle
 * into the row.
 *
 * The calendar keeps its own draft selection and only commits on Apply —
 * a range picker is a two-click gesture (start, then end), and reacting to
 * the first click would fire a query for a single-day range nobody asked
 * for.
 */
export function AnalyticsRangeFilter({
  preset,
  customFrom,
  customTo,
  onPresetChange,
  onCustomChange,
}: {
  preset: RangePreset;
  customFrom: Date | null;
  customTo: Date | null;
  onPresetChange: (preset: QuickPreset) => void;
  onCustomChange: (from: Date, to: Date) => void;
}) {
  const [draft, setDraft] = useState<DateRange | undefined>(
    customFrom && customTo ? { from: customFrom, to: customTo } : undefined,
  );
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup
        type="single"
        value={preset === "custom" ? "" : preset}
        onValueChange={(v) => v && onPresetChange(v as QuickPreset)}
      >
        {QUICK_PRESETS.map((key) => (
          <ToggleGroupItem key={key} value={key} size="sm" className="text-xs">
            {PRESET_LABEL[key]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          // Re-seed the draft from the committed range each time the popover
          // opens, so a cancelled edit never leaks into the next open.
          if (next) {
            setDraft(customFrom && customTo ? { from: customFrom, to: customTo } : undefined);
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant={preset === "custom" ? "default" : "outline"}
            size="sm"
            className="text-xs"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {preset === "custom" && customFrom && customTo
              ? `${format(customFrom, "MMM d")} – ${format(customTo, "MMM d, yyyy")}`
              : "Custom"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={draft}
            onSelect={setDraft}
            disabled={{ after: new Date() }}
            defaultMonth={draft?.from ?? customFrom ?? undefined}
          />
          <div className="flex justify-end gap-2 border-t p-3">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!draft?.from || !draft?.to}
              onClick={() => {
                if (draft?.from && draft.to) {
                  onCustomChange(draft.from, draft.to);
                  setOpen(false);
                }
              }}
            >
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
