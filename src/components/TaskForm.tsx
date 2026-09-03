import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoleMultiSelect, type RoleOption } from "@/components/RoleMultiSelect";

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  due_date: z.string().optional().or(z.literal("")),
  // Optional "HH:MM"; when set the task syncs as a timed event of `duration` minutes.
  due_time: z.string().optional().or(z.literal("")),
  duration: z.number().int().positive(),
  done: z.boolean(),
  priority: z.boolean(),
  roleIds: z.array(z.string()),
});

export type TaskFormValues = z.infer<typeof taskSchema>;

/** Duration choices (minutes) offered when a task is given a time. */
export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

/** Format a stored TIME ("HH:MM[:SS]") down to "HH:MM" for display/inputs. */
export function toHhMm(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : "";
}

/** "30 min", "1 h", "1 h 30 min" — for the duration picker. */
export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

/**
 * A styled hour:minute picker built from the app's Select, replacing the browser's
 * native `type="time"` UI so it matches the rest of the form. Value is "HH:MM" (or
 * "" for none); picking an hour defaults the minute to :00 and vice-versa.
 */
function TimeSelect({
  id,
  value,
  onChange,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [h, m] = value ? value.split(":") : ["", ""];
  return (
    <div className="flex items-center gap-2">
      <Select value={h} onValueChange={(hh) => onChange(`${hh}:${m || "00"}`)} disabled={disabled}>
        <SelectTrigger id={id} className="flex-1" aria-label="Hour">
          <SelectValue placeholder="Hour" />
        </SelectTrigger>
        <SelectContent className="max-h-56">
          {HOURS.map((hh) => (
            <SelectItem key={hh} value={hh}>
              {hh}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground">:</span>
      <Select value={m} onValueChange={(mm) => onChange(`${h || "09"}:${mm}`)} disabled={disabled}>
        <SelectTrigger className="flex-1" aria-label="Minute">
          <SelectValue placeholder="Min" />
        </SelectTrigger>
        <SelectContent className="max-h-56">
          {MINUTES.map((mm) => (
            <SelectItem key={mm} value={mm}>
              {mm}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * The task create/edit form — shared by the Tasks page and the Applications
 * page's "New task" dialog, so there's one place that knows how to add or
 * change a follow-up, however you got to it.
 */
export function TaskForm({
  roles,
  initialValues,
  showDone = false,
  isPending,
  onSubmit,
}: {
  roles: RoleOption[];
  initialValues?: TaskFormValues;
  showDone?: boolean;
  isPending: boolean;
  onSubmit: (values: TaskFormValues) => void;
}) {
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [dueDate, setDueDate] = useState(initialValues?.due_date ?? "");
  const [dueTime, setDueTime] = useState(initialValues?.due_time ?? "");
  const [duration, setDuration] = useState(initialValues?.duration ?? 30);
  const [done, setDone] = useState(initialValues?.done ?? false);
  const [priority, setPriority] = useState(initialValues?.priority ?? false);
  const [roleIds, setRoleIds] = useState<string[]>(initialValues?.roleIds ?? []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = taskSchema.safeParse({
      title,
      due_date: dueDate,
      due_time: dueTime,
      duration,
      done,
      priority,
      roleIds,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    onSubmit(parsed.data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="task-title">Title</Label>
        <Input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Send follow-up email"
          required
          autoComplete="off"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="task-due-date">Due date</Label>
          <Input
            id="task-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="task-due-time">
              Time <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            {dueDate && dueTime && (
              <button
                type="button"
                onClick={() => setDueTime("")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
          <TimeSelect
            id="task-due-time"
            value={dueTime}
            onChange={setDueTime}
            disabled={!dueDate}
          />
        </div>
      </div>

      {/* Duration only matters once a time is set; otherwise the task is all-day. */}
      {dueDate && dueTime ? (
        <div className="space-y-2">
          <Label htmlFor="task-duration">Duration</Label>
          <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
            <SelectTrigger id="task-duration" className="w-full sm:w-48">
              <SelectValue>{formatDuration(duration)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DURATION_OPTIONS.map((min) => (
                <SelectItem key={min} value={String(min)}>
                  {formatDuration(min)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        dueDate && (
          <p className="text-xs text-muted-foreground">
            No time set — this syncs as an all-day event. Add a time to make it a timed event.
          </p>
        )
      )}

      {showDone && (
        <label className="flex w-fit items-center gap-2 text-sm">
          <Checkbox checked={done} onCheckedChange={(v) => setDone(!!v)} />
          Completed
        </label>
      )}
      <label className="flex w-fit items-center gap-2 text-sm">
        <Checkbox checked={priority} onCheckedChange={(v) => setPriority(!!v)} />
        <Star
          className={`h-4 w-4 ${priority ? "fill-[var(--status-interviewing-text)] text-[var(--status-interviewing-text)]" : "text-muted-foreground"}`}
        />
        High priority
      </label>
      <div className="space-y-2">
        <Label>Roles</Label>
        <RoleMultiSelect roles={roles} selected={roleIds} onChange={setRoleIds} />
        <p className="text-xs text-muted-foreground">
          Attach this task to any of the roles you're pursuing — the same task can cover more than
          one.
        </p>
      </div>
      <DialogFooter>
        <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
