import { useMemo, useState } from "react";
import { Flame, Minus, Pencil, Plus, Target, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  applicationsPerDay,
  bestStreak,
  currentStreak,
  lastDays,
  localDateKey,
  type GoalApplication,
} from "@/lib/daily-goal";

const MIN_GOAL = 1;
const MAX_GOAL = 50;
/** Five weeks of history: enough to see a habit form, small enough to read at a glance. */
const WEEKS = 5;
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * A daily target for applications sent, and whether it's being hit day after
 * day. Getting hired is mostly a consistency game, so the streak and the
 * calendar matter more here than any single day's count.
 */
export function DailyGoalTracker({
  apps,
  goal,
  onGoalChange,
}: {
  apps: GoalApplication[];
  goal: number;
  onGoalChange: (goal: number) => void;
}) {
  const today = localDateKey(new Date());
  const counts = useMemo(() => applicationsPerDay(apps), [apps]);
  const sentToday = counts.get(today) ?? 0;
  const streak = useMemo(() => currentStreak(counts, goal, today), [counts, goal, today]);
  const best = useMemo(() => bestStreak(counts, goal), [counts, goal]);
  const last30Met = useMemo(
    () => lastDays(today, 30).filter((d) => (counts.get(d) ?? 0) >= goal).length,
    [counts, goal, today],
  );

  // Calendar rows run Monday → Sunday, so the grid starts on the Monday
  // WEEKS-1 weeks before this one and runs through this Sunday; days after
  // today are drawn as blanks rather than misses.
  const grid = useMemo(() => {
    const now = new Date();
    const mondayOffset = (now.getDay() + 6) % 7;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
    start.setDate(start.getDate() - (WEEKS - 1) * 7);
    return Array.from({ length: WEEKS * 7 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return { key: localDateKey(d), date: d };
    });
  }, []);

  const met = sentToday >= goal;
  const remaining = Math.max(goal - sentToday, 0);

  return (
    <section aria-label="Daily goal" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Target className="h-4 w-4" aria-hidden /> Daily goal
        </h2>
        <GoalEditor goal={goal} onSave={onGoalChange} />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <p className="text-sm">
            <span className="text-2xl font-semibold tracking-tight">{sentToday}</span>
            <span className="text-muted-foreground">
              {" "}
              / {goal} {goal === 1 ? "application" : "applications"} today
            </span>
          </p>
        </div>
        <Progress
          value={Math.min((sentToday / goal) * 100, 100)}
          className={`h-1.5 ${met ? "[&>div]:bg-[var(--status-offer)]" : ""}`}
          aria-label="Today's applications against the goal"
        />
        <p
          className={`text-xs ${met ? "font-medium text-[var(--status-offer-text)]" : "text-muted-foreground"}`}
        >
          {met
            ? "Goal met for today — keep the streak going tomorrow."
            : `${remaining} more to hit today's goal.`}
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-2">
        <GoalStat icon={<Flame className="h-3.5 w-3.5" aria-hidden />} label="Streak">
          {streak} {streak === 1 ? "day" : "days"}
        </GoalStat>
        <GoalStat icon={<Trophy className="h-3.5 w-3.5" aria-hidden />} label="Best">
          {best} {best === 1 ? "day" : "days"}
        </GoalStat>
        <GoalStat label="Last 30d">{last30Met} / 30</GoalStat>
      </dl>

      <div>
        <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Last five weeks">
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="text-center text-[10px] text-muted-foreground" aria-hidden>
              {d}
            </span>
          ))}
          {grid.map(({ key, date }) => {
            const n = counts.get(key) ?? 0;
            const future = key > today;
            const label = date.toLocaleDateString(undefined, {
              weekday: "short",
              day: "numeric",
              month: "short",
            });
            const tone = future
              ? "border-dashed bg-transparent"
              : n >= goal
                ? "border-transparent bg-[var(--status-offer)]"
                : n > 0
                  ? "border-transparent bg-[var(--status-offer-soft)]"
                  : "bg-background";
            return (
              <span
                key={key}
                role="gridcell"
                title={future ? label : `${label}: ${n} of ${goal}`}
                aria-label={future ? `${label}: upcoming` : `${label}: ${n} of ${goal} sent`}
                className={`aspect-square rounded-[4px] border ${tone} ${
                  key === today ? "ring-2 ring-foreground/60 ring-offset-1 ring-offset-muted" : ""
                }`}
              />
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
          <LegendSwatch className="bg-background">None</LegendSwatch>
          <LegendSwatch className="border-transparent bg-[var(--status-offer-soft)]">
            Some
          </LegendSwatch>
          <LegendSwatch className="border-transparent bg-[var(--status-offer)]">
            Goal met
          </LegendSwatch>
        </div>
      </div>
    </section>
  );
}

function GoalStat({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-background px-2.5 py-2">
      <dt className="flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="whitespace-nowrap text-sm font-semibold">{children}</dd>
    </div>
  );
}

function LegendSwatch({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-2.5 w-2.5 rounded-[3px] border ${className}`} aria-hidden />
      {children}
    </span>
  );
}

function GoalEditor({ goal, onSave }: { goal: number; onSave: (goal: number) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(goal);
  const clamp = (n: number) => Math.min(Math.max(n, MIN_GOAL), MAX_GOAL);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft(goal);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Daily goal: ${goal} per day. Change`}>
          {goal} / day <Pencil className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 space-y-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Applications per day</p>
          <p className="text-xs text-muted-foreground">
            Pick a number you can keep up every day — a steady pace beats a burst.
          </p>
        </div>
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="icon"
            aria-label="Fewer"
            disabled={draft <= MIN_GOAL}
            onClick={() => setDraft((d) => clamp(d - 1))}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="text-2xl font-semibold" aria-live="polite">
            {draft}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="More"
            disabled={draft >= MAX_GOAL}
            onClick={() => setDraft((d) => clamp(d + 1))}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={draft === goal}
            onClick={() => {
              onSave(draft);
              setOpen(false);
            }}
          >
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
