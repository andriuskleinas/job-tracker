/**
 * Small date helpers for the application board. Everything works off calendar
 * days (dates are stored as `YYYY-MM-DD`), so "17d ago" lines up with what a
 * person would count on a calendar rather than exact 24h windows.
 */

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Whole calendar days from `dateStr` to `to` (default today). Positive = past. */
export function daysAgo(dateStr: string, to: string = todayISO()): number {
  const from = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  const until = new Date(`${to.slice(0, 10)}T00:00:00`);
  return Math.round((until.getTime() - from.getTime()) / 86_400_000);
}

/** How long ago something happened, compact: "today", "1d ago", "3mo ago". */
export function relativeDay(dateStr: string): string {
  const d = daysAgo(dateStr);
  if (d <= 0) return "today";
  if (d < 60) return `${d}d ago`;
  const months = Math.round(d / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(d / 365)}y ago`;
}

/** When something is due relative to now: "due in 3d", "due today", "2d overdue". */
export function relativeDue(dateStr: string): string {
  const past = daysAgo(dateStr); // positive = the due date is behind us
  if (past > 0) return past === 1 ? "1d overdue" : `${past}d overdue`;
  if (past === 0) return "due today";
  const inDays = -past;
  if (inDays < 60) return `due in ${inDays}d`;
  return `due in ${Math.round(inDays / 30)}mo`;
}
