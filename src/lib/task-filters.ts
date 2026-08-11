import { daysAgo } from "@/lib/relative-time";
import type { RoleOption } from "@/components/RoleMultiSelect";

/**
 * The Tasks page filter model, mirroring the applications board: every axis is
 * independent and combines with AND, and empty everywhere means "show all".
 *
 *   roleIds           keep tasks linked to any of these applications
 *   due               keep tasks falling in any of these urgency windows
 *   highPriorityOnly  keep only starred (high-priority) tasks
 *   hideCompleted     drop done tasks entirely
 *
 * Kept deliberately small — the board's own filters (status, location, text)
 * live on applications, not their follow-ups.
 */
export type TaskFilters = {
  roleIds: string[];
  due: DueWindow[];
  highPriorityOnly: boolean;
  hideCompleted: boolean;
};

export const EMPTY_TASK_FILTERS: TaskFilters = {
  roleIds: [],
  due: [],
  highPriorityOnly: false,
  hideCompleted: false,
};

/**
 * Urgency windows for a task's due date — the same buckets the list groups by,
 * so a "This week" filter and the "This week" heading always mean one thing.
 */
export type DueWindow = "overdue" | "today" | "week" | "later" | "nodate";

export const DUE_WINDOW_ORDER: DueWindow[] = ["overdue", "today", "week", "later", "nodate"];

export const DUE_WINDOW_LABEL: Record<DueWindow, string> = {
  overdue: "Overdue",
  today: "Today",
  week: "This week",
  later: "Later",
  nodate: "No date",
};

export function dueBucket(due: string | null): DueWindow {
  if (!due) return "nodate";
  const past = daysAgo(due); // positive = the due date is behind us
  if (past > 0) return "overdue";
  if (past === 0) return "today";
  return -past <= 7 ? "week" : "later";
}

/** The minimum shape the filters need — TaskRow satisfies it structurally. */
export type TaskLike = {
  due_date: string | null;
  done: boolean;
  priority: boolean;
  task_applications: { application: { id: string; company: string; position: string } | null }[];
};

/** True when any axis would narrow the list — drives the Clear affordance. */
export function hasActiveTaskFilters(f: TaskFilters): boolean {
  return f.roleIds.length > 0 || f.due.length > 0 || f.highPriorityOnly || f.hideCompleted;
}

/** How many axes are active — shown as a badge on the Clear control. */
export function activeTaskFilterCount(f: TaskFilters): number {
  return (
    (f.roleIds.length ? 1 : 0) +
    (f.due.length ? 1 : 0) +
    (f.highPriorityOnly ? 1 : 0) +
    (f.hideCompleted ? 1 : 0)
  );
}

/** Apply the filter set to a list. Pure, so it's cheap to memoize and to test. */
export function filterTasks<T extends TaskLike>(tasks: T[], f: TaskFilters): T[] {
  const roles = new Set(f.roleIds);
  const windows = new Set(f.due);

  return tasks.filter((t) => {
    if (f.hideCompleted && t.done) return false;
    if (f.highPriorityOnly && !t.priority) return false;
    if (windows.size && !windows.has(dueBucket(t.due_date))) return false;
    if (roles.size) {
      const linked = t.task_applications.some(
        (ta) => ta.application && roles.has(ta.application.id),
      );
      if (!linked) return false;
    }
    return true;
  });
}

/**
 * The roles actually attached to at least one task, so the role picker never
 * offers an option that would match nothing. First-seen label wins; sorted by
 * position then company to line up with how roles read elsewhere.
 */
export function availableTaskRoles(tasks: TaskLike[]): RoleOption[] {
  const seen = new Map<string, RoleOption>();
  for (const t of tasks) {
    for (const ta of t.task_applications) {
      const a = ta.application;
      if (a && !seen.has(a.id))
        seen.set(a.id, { id: a.id, company: a.company, position: a.position });
    }
  }
  return [...seen.values()].sort((a, b) =>
    `${a.position} ${a.company}`.localeCompare(`${b.position} ${b.company}`),
  );
}
