import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export const TASK_WINDOW_PRESETS = ["7d", "14d", "30d", "custom"] as const;
export type TaskWindowPreset = (typeof TASK_WINDOW_PRESETS)[number];
type QuickTaskPreset = Exclude<TaskWindowPreset, "custom">;

const QUICK_PRESETS: readonly QuickTaskPreset[] = ["7d", "14d", "30d"];
const PRESET_LABEL: Record<QuickTaskPreset, string> = {
  "7d": "7 days",
  "14d": "14 days",
  "30d": "30 days",
};

/**
 * The "Next N days" panel's own window, independent of the page-wide
 * date-range filter above it.
 *
 * The two controls look like siblings but answer different questions: the
 * page filter is backward-looking ("what did I send in the last 30 days"),
 * this one is forward-looking ("what's due in the next 30"). There's no
 * "all time" option here for the same reason there's no "from" date to
 * pick for a custom window — a task list has one edge, not two, so custom
 * is a single "due by" date rather than a range.
 */
export function TaskWindowFilter({
  preset,
  customDue,
  onPresetChange,
  onCustomChange,
}: {
  preset: TaskWindowPreset;
  customDue: Date | null;
  onPresetChange: (preset: QuickTaskPreset) => void;
  onCustomChange: (due: Date) => void;
}) {
  const [draft, setDraft] = useState<Date | undefined>(customDue ?? undefined);
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup
        type="single"
        value={preset === "custom" ? "" : preset}
        onValueChange={(v) => v && onPresetChange(v as QuickTaskPreset)}
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
          if (next) setDraft(customDue ?? undefined);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant={preset === "custom" ? "default" : "outline"}
            size="sm"
            className="text-xs"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {preset === "custom" && customDue ? `Due by ${format(customDue, "MMM d")}` : "Custom"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={draft}
            onSelect={setDraft}
            disabled={{ before: new Date() }}
            defaultMonth={draft ?? customDue ?? undefined}
          />
          <div className="flex justify-end gap-2 border-t p-3">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!draft}
              onClick={() => {
                if (draft) {
                  onCustomChange(draft);
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
