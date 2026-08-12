// Shared shaping of a task into calendar-event fields, used by both the iCal feed
// (src/lib/calendar-ics.ts) and the Google Calendar push
// (src/lib/google-calendar.server.ts) so the two can never drift. Isomorphic and
// dependency-free.

export type TaskEventInput = {
  id: string;
  title: string;
  /** DATE-only string, e.g. "2026-08-15". Null means the task can't be an event. */
  due_date: string | null;
  done?: boolean;
  applications: { company: string; position: string }[];
};

/** A task belongs on a calendar only when it's open and has a due date. */
export function shouldHaveEvent(task: { due_date: string | null; done?: boolean }): boolean {
  return !task.done && !!task.due_date;
}

/** "Send follow-up — Acme, Globex" — title, with linked companies for context. */
export function taskEventSummary(task: TaskEventInput): string {
  const companies = task.applications.map((a) => a.company).filter(Boolean);
  return companies.length ? `${task.title} — ${companies.join(", ")}` : task.title;
}

/** Linked roles (one per line) plus a link back to the Tasks page. */
export function taskEventDescription(task: TaskEventInput, appUrl: string): string {
  const roleText = task.applications.length
    ? task.applications.map((a) => `${a.position} · ${a.company}`).join("\n")
    : "";
  return [roleText, `Open in Job Tracker: ${appUrl}/tasks`].filter(Boolean).join("\n\n");
}

/**
 * The day after `date` as an ISO "YYYY-MM-DD" string. All-day events use a
 * non-inclusive end, so a task due on the 15th spans start 15th → end 16th.
 * Computed in UTC to avoid any local-timezone date rollover.
 */
export function nextDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const yyyy = next.getUTCFullYear().toString().padStart(4, "0");
  const mm = (next.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = next.getUTCDate().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
