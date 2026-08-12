// Builds an RFC 5545 iCalendar (.ics) document from tasks, for the subscribable
// calendar feed. Kept isomorphic and dependency-free so it can be unit-tested in
// plain Node and imported anywhere — the server feed handler is its only caller.
import { nextDay, taskEventDescription, taskEventSummary } from "./task-event";

/** The shape the feed needs from a task. A task's linked roles give the event context. */
export type CalendarTask = {
  id: string;
  title: string;
  /** DATE-only string, e.g. "2026-08-15". Tasks without one are not feed-able. */
  due_date: string | null;
  /** timestamptz ISO string; drives LAST-MODIFIED so calendars re-render on edits. */
  updated_at: string | null;
  applications: { company: string; position: string }[];
};

const PRODID = "-//Job Tracker//Tasks Calendar//EN";

/**
 * Escape a text value per RFC 5545 §3.3.11: backslash first (so we don't
 * double-escape the ones we add), then the structural characters, then newlines.
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** An ISO "YYYY-MM-DD" date to the compact DATE value "YYYYMMDD" iCal wants. */
function toDateValue(date: string): string {
  return date.replace(/-/g, "").slice(0, 8);
}

/** A UTC timestamp value "YYYYMMDDTHHMMSSZ" for DTSTAMP / LAST-MODIFIED. */
function toStampValue(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/**
 * Fold a content line to <=75 octets per RFC 5545 §3.1, splitting on UTF-8
 * character boundaries and prefixing continuation lines with a single space.
 * Measured in bytes, not code units, so multibyte names (em dashes, accents)
 * never overflow a line.
 */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of line) {
    const charBytes = encoder.encode(char).length;
    // Continuation lines carry a leading space, so their budget is 74 + the space.
    const limit = out.length === 0 ? 75 : 74;
    if (currentBytes + charBytes > limit) {
      out.push(current);
      current = char;
      currentBytes = charBytes;
    } else {
      current += char;
      currentBytes += charBytes;
    }
  }
  out.push(current);
  return out.join("\r\n ");
}

/** One VEVENT block (as an array of already-folded lines). */
function eventLines(task: CalendarTask, appUrl: string, stamp: string): string[] {
  // Summary/description come from the shared task-event helpers so the feed and the
  // Google push describe a task identically.
  const summary = taskEventSummary(task);
  const description = taskEventDescription(task, appUrl);

  const lastModified = task.updated_at ? toStampValue(new Date(task.updated_at)) : stamp;
  const due = task.due_date as string; // callers filter out null due dates

  return [
    "BEGIN:VEVENT",
    foldLine(`UID:task-${task.id}@job-tracker`),
    `DTSTAMP:${stamp}`,
    `LAST-MODIFIED:${lastModified}`,
    `DTSTART;VALUE=DATE:${toDateValue(due)}`,
    `DTEND;VALUE=DATE:${toDateValue(nextDay(due))}`,
    foldLine(`SUMMARY:${escapeText(summary)}`),
    foldLine(`DESCRIPTION:${escapeText(description)}`),
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
  ];
}

/**
 * Render a full VCALENDAR document from the given tasks. Callers pass only the
 * tasks that belong on a calendar (open, with a due date); everything here is
 * pure formatting. `appUrl` is the site origin, used for the back-link and to
 * make UIDs recognisably ours.
 */
export function buildTasksICS(tasks: CalendarTask[], { appUrl }: { appUrl: string }): string {
  const stamp = toStampValue(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    foldLine(`PRODID:${PRODID}`),
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Job Tracker — Tasks",
    "X-WR-CALDESC:Your open job-search follow-ups, synced from Job Tracker.",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
    ...tasks.flatMap((task) => eventLines(task, appUrl, stamp)),
    "END:VCALENDAR",
  ];
  // RFC 5545 mandates CRLF line endings, with a trailing CRLF on the last line.
  return lines.join("\r\n") + "\r\n";
}
