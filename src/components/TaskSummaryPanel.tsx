import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ListChecks, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { daysAgo, relativeDue } from "@/lib/relative-time";
import { syncTaskCalendar } from "@/lib/calendar-sync";

type LinkedRole = { id: string; company: string; position: string };

/**
 * A task carries every role it was assigned to, not one. The shape — and the
 * select below — has to stay identical to the analytics page's, because both
 * read the same `["tasks", "all"]` cache entry and whichever mounts first is
 * the one that fills it.
 */
export type PanelTask = {
  id: string;
  title: string;
  done: boolean;
  priority: boolean;
  due_date: string | null;
  due_time: string | null;
  task_applications: { application: LinkedRole | null }[];
};

/**
 * Where an open task stands against today. These are the panel's statuses —
 * a task itself only knows done/not done, so "where it stands" is read off
 * its due date, the same calendar-day arithmetic the card chips use.
 */
type Bucket = "overdue" | "today" | "week" | "later" | "undated";

const BUCKETS: { key: Bucket; label: string }[] = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "week", label: "Next 7 days" },
  { key: "later", label: "Later" },
  { key: "undated", label: "No due date" },
];

function bucketFor(t: PanelTask): Bucket {
  if (!t.due_date) return "undated";
  const past = daysAgo(t.due_date);
  if (past > 0) return "overdue";
  if (past === 0) return "today";
  if (past >= -7) return "week";
  return "later";
}

/** Priority first, then soonest due (time breaks a same-day tie), then title. */
function compareTasks(a: PanelTask, b: PanelTask): number {
  if (a.priority !== b.priority) return a.priority ? -1 : 1;
  const ad = `${a.due_date ?? "9999"}T${a.due_time ?? "99"}`;
  const bd = `${b.due_date ?? "9999"}T${b.due_time ?? "99"}`;
  return ad.localeCompare(bd) || a.title.localeCompare(b.title);
}

const linkedRoles = (t: PanelTask): LinkedRole[] =>
  (t.task_applications ?? []).map((ta) => ta.application).filter((a): a is LinkedRole => !!a);

export function useAllTasks() {
  return useQuery({
    queryKey: ["tasks", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, task_applications(application:applications(id, company, position))")
        .order("done")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as unknown as PanelTask[];
    },
  });
}

/** Overdue open tasks — what the panel's toggle button flags in red. */
export function countOverdue(tasks: PanelTask[]): number {
  return tasks.filter((t) => !t.done && bucketFor(t) === "overdue").length;
}

/**
 * Every task across every application in one place: how far along you are,
 * what's late, what's next. Cards only show a count per role; this is the
 * view across all of them, and where a task gets ticked off without opening
 * the application it belongs to.
 */
export function TaskSummaryPanel({
  tasks,
  isLoading,
  onNewTask,
}: {
  tasks: PanelTask[];
  isLoading: boolean;
  onNewTask: () => void;
}) {
  const queryClient = useQueryClient();
  const [doneOpen, setDoneOpen] = useState(false);

  // Optimistic so the row moves between groups as the box is ticked, not a
  // round trip later. Applications are invalidated too — the cards' task
  // chips count open tasks.
  const toggleDone = useMutation({
    mutationFn: async ({ tid, done }: { tid: string; done: boolean }) => {
      const { error } = await supabase.from("tasks").update({ done }).eq("id", tid);
      if (error) throw error;
    },
    onMutate: async ({ tid, done }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", "all"] });
      const previous = queryClient.getQueryData<PanelTask[]>(["tasks", "all"]);
      queryClient.setQueryData<PanelTask[]>(["tasks", "all"], (old) =>
        (old ?? []).map((t) => (t.id === tid ? { ...t, done } : t)),
      );
      return { previous };
    },
    onError: (e, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["tasks", "all"], context.previous);
      toast.error(e instanceof Error ? e.message : "Failed to update task");
    },
    onSuccess: (_data, { tid }) => void syncTaskCalendar(tid),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });

  const { groups, done, openCount } = useMemo(() => {
    const groups = new Map<Bucket, PanelTask[]>(BUCKETS.map((b) => [b.key, []]));
    const done: PanelTask[] = [];
    for (const t of tasks) {
      if (t.done) done.push(t);
      else groups.get(bucketFor(t))!.push(t);
    }
    for (const list of groups.values()) list.sort(compareTasks);
    done.sort((a, b) => a.title.localeCompare(b.title));
    return { groups, done, openCount: tasks.length - done.length };
  }, [tasks]);

  const total = tasks.length;
  const progress = total === 0 ? 0 : Math.round((done.length / total) * 100);
  const thisWeek = groups.get("today")!.length + groups.get("week")!.length;

  const toggle = (t: PanelTask, next: boolean) => toggleDone.mutate({ tid: t.id, done: next });

  return (
    <section aria-label="Tasks" className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <ListChecks className="h-4 w-4" aria-hidden /> Tasks
        </h2>
        <Button variant="outline" size="sm" onClick={onNewTask}>
          <Plus className="h-4 w-4" /> New task
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground">
          No tasks yet. Add the next thing you owe an application — a follow-up, a prep session, a
          thank-you note.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">
                {done.length} of {total} done
              </span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" aria-label="Tasks completed" />
          </div>

          <dl className="grid grid-cols-3 gap-2">
            <SummaryStat
              label="Overdue"
              value={groups.get("overdue")!.length}
              alert={groups.get("overdue")!.length > 0}
            />
            <SummaryStat label="This week" value={thisWeek} />
            <SummaryStat label="Open" value={openCount} />
          </dl>

          {openCount === 0 ? (
            <p className="text-sm text-muted-foreground">All caught up — nothing open.</p>
          ) : (
            <div className="space-y-4">
              {BUCKETS.map(({ key, label }) => {
                const list = groups.get(key)!;
                if (list.length === 0) return null;
                return (
                  <div key={key}>
                    <h3
                      className={`mb-1 text-xs font-medium uppercase tracking-wide ${
                        key === "overdue" ? "text-brand-accent" : "text-muted-foreground"
                      }`}
                    >
                      {label} · {list.length}
                    </h3>
                    <ul className="divide-y">
                      {list.map((t) => (
                        <TaskRow key={t.id} task={t} onToggle={(v) => toggle(t, v)} />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}

          {done.length > 0 && (
            <Collapsible open={doneOpen} onOpenChange={setDoneOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 text-muted-foreground hover:text-foreground"
                >
                  <ChevronRight
                    className={`h-4 w-4 transition-transform ${doneOpen ? "rotate-90" : ""}`}
                  />
                  Completed · {done.length}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="divide-y">
                  {done.map((t) => (
                    <TaskRow key={t.id} task={t} onToggle={(v) => toggle(t, v)} />
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}
    </section>
  );
}

function SummaryStat({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="rounded-lg border px-2.5 py-2">
      <dt className="whitespace-nowrap text-xs text-muted-foreground">{label}</dt>
      <dd className={`text-lg font-semibold ${alert ? "text-brand-accent" : ""}`}>{value}</dd>
    </div>
  );
}

function TaskRow({ task: t, onToggle }: { task: PanelTask; onToggle: (done: boolean) => void }) {
  const roles = linkedRoles(t);
  const overdue = !t.done && bucketFor(t) === "overdue";
  return (
    <li className="flex items-start gap-2.5 py-2">
      <Checkbox
        className="mt-0.5 shrink-0"
        checked={t.done}
        onCheckedChange={(v) => onToggle(!!v)}
        aria-label={t.done ? `Mark not done: ${t.title}` : `Mark done: ${t.title}`}
      />
      <div className="min-w-0 flex-1">
        <p
          className={`flex items-start gap-1 text-sm ${t.done ? "text-muted-foreground line-through" : ""}`}
        >
          <span className="min-w-0 break-words">{t.title}</span>
          {t.priority && !t.done && (
            <Star
              className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-current text-[var(--status-interviewing-text)]"
              aria-label="High priority"
            />
          )}
        </p>
        {/* One task can cover several roles; the row has room for one, so the
            rest are counted rather than listed. */}
        {roles.length > 0 && (
          <p className="truncate text-xs text-muted-foreground">
            <Link
              to="/applications/$id"
              params={{ id: roles[0].id }}
              className="hover:text-foreground hover:underline"
            >
              {roles[0].company}
            </Link>
            {roles.length > 1 && ` +${roles.length - 1} more`}
          </p>
        )}
        {t.due_date && !t.done && (
          <p
            className={`text-xs ${overdue ? "font-medium text-brand-accent" : "text-muted-foreground"}`}
          >
            {relativeDue(t.due_date)}
            {t.due_time && ` · ${t.due_time.slice(0, 5)}`}
          </p>
        )}
      </div>
    </li>
  );
}
