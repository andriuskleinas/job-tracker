// Shared shaping of a task into calendar-event fields, used by both the iCal feed
// (src/lib/calendar-ics.ts) and the Google Calendar push
// (src/lib/google-calendar.server.ts) so the two can never drift. Isomorphic and
// dependency-free.

export type TaskEventInput = {
  id: string;
  title: string;
  /** DATE-only string, e.g. "2026-08-15". Null means the task can't be an event. */
  due_date: string | null;
  /** TIME string ("HH:MM" or "HH:MM:SS"), or null for an all-day task. */
  due_time?: string | null;
  /** Length in minutes when a time is set; falls back to DEFAULT_DURATION_MIN. */
  duration_minutes?: number | null;
  done?: boolean;
  applications: { company: string; position: string }[];
};

/** Length of a timed task when the user set a time but no explicit duration. */
export const DEFAULT_DURATION_MIN = 30;

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

/** Normalise a TIME value to "HH:MM:SS" (accepts "HH:MM" from the time input). */
function normalizeTime(time: string): string {
  const [h = "0", m = "0", s = "0"] = time.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${s.padStart(2, "0")}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * A local wall-clock datetime `date`+`time` shifted by `minutes`, returned as a
 * naive "YYYY-MM-DDTHH:MM:SS" string. Arithmetic runs in UTC purely to normalise
 * the components (handling minute/hour/day rollover); no timezone is implied — the
 * caller attaches the zone. DST drift over a short task duration is negligible.
 */
function addMinutesLocal(date: string, time: string, minutes: number): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi, s] = normalizeTime(time).split(":").map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d, h, mi, s) + minutes * 60_000);
  return (
    `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}` +
    `T${pad2(t.getUTCHours())}:${pad2(t.getUTCMinutes())}:${pad2(t.getUTCSeconds())}`
  );
}

/** All-day vs timed bounds for a task. Dates are "YYYY-MM-DD"; datetimes are naive
 *  local "YYYY-MM-DDTHH:MM:SS" that the caller pairs with a timezone. */
export type EventTiming =
  | { allDay: true; start: string; end: string }
  | { allDay: false; start: string; end: string };

/**
 * Decide how a task sits on a calendar: with no `due_time` it's an all-day event
 * (start date → next day); with a time it's a timed event starting then and lasting
 * `duration_minutes` (or DEFAULT_DURATION_MIN). Callers pass only tasks with a due
 * date (see `shouldHaveEvent`).
 */
export function taskEventTiming(task: TaskEventInput): EventTiming {
  const date = task.due_date as string;
  if (!task.due_time) {
    return { allDay: true, start: date, end: nextDay(date) };
  }
  const time = normalizeTime(task.due_time);
  const minutes =
    task.duration_minutes && task.duration_minutes > 0
      ? task.duration_minutes
      : DEFAULT_DURATION_MIN;
  return { allDay: false, start: `${date}T${time}`, end: addMinutesLocal(date, time, minutes) };
}

/** Offset (ms) such that `wall = utcInstant + offset` for `tz` at that instant. */
function tzOffsetMs(utcMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(new Date(utcMs))) p[part.type] = part.value;
  const asUTC = Date.UTC(
    +p.year,
    +p.month - 1,
    +p.day,
    +p.hour === 24 ? 0 : +p.hour,
    +p.minute,
    +p.second,
  );
  return asUTC - utcMs;
}

/**
 * Convert a naive local datetime ("YYYY-MM-DDTHH:MM:SS") in IANA zone `tz` to a UTC
 * iCal stamp "YYYYMMDDTHHMMSSZ". Refines the offset once so DST boundaries resolve
 * correctly. Used by the .ics feed, which emits absolute UTC times.
 */
export function localToUtcStamp(localDateTime: string, tz: string): string {
  const [datePart, timePart = "00:00:00"] = localDateTime.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi, s] = normalizeTime(timePart).split(":").map(Number);
  const wallAsUTC = Date.UTC(y, mo - 1, d, h, mi, s);
  let utc = wallAsUTC - tzOffsetMs(wallAsUTC, tz);
  utc = wallAsUTC - tzOffsetMs(utc, tz);
  return new Date(utc)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}
