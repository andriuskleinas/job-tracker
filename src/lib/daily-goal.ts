/**
 * The arithmetic behind the daily application goal: how many applications
 * went out on each calendar day, and how many days in a row the goal was met.
 * Pure and dependency-free so it can be tested without a browser.
 *
 * A day is the `application_date` column, which is a plain `YYYY-MM-DD` with
 * no zone — the date the user says they applied. Wishlist rows are left out:
 * their date is only a placeholder until they are actually sent (see the
 * applications page's `moveStatus`). Rejected and withdrawn ones count — they
 * were sent, which is the habit being tracked.
 */

export type GoalApplication = { status: string; application_date: string };

/** `YYYY-MM-DD` for a Date in the browser's own zone (not UTC, unlike toISOString). */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The day before `key`, as a key. */
function previousKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return localDateKey(new Date(y, m - 1, d - 1));
}

/** Applications sent per day, keyed `YYYY-MM-DD`. Days with none are absent. */
export function applicationsPerDay(apps: GoalApplication[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const a of apps) {
    if (a.status === "wishlist") continue;
    const key = a.application_date.slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * Consecutive days, ending today, on which the goal was met.
 *
 * Today only adds to a streak — it never breaks one. Until midnight there is
 * still time to apply, so a streak that ran through yesterday is still alive
 * this morning with nothing sent yet.
 */
export function currentStreak(counts: Map<string, number>, goal: number, today: string): number {
  let streak = 0;
  let day = today;
  if ((counts.get(day) ?? 0) >= goal) streak++;
  day = previousKey(day);
  while ((counts.get(day) ?? 0) >= goal) {
    streak++;
    day = previousKey(day);
  }
  return streak;
}

/** The longest run of consecutive goal-met days on record. */
export function bestStreak(counts: Map<string, number>, goal: number): number {
  const metDays = [...counts.entries()]
    .filter(([, n]) => n >= goal)
    .map(([k]) => k)
    .sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of metDays) {
    run = prev !== null && previousKey(day) === prev ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return best;
}

/** The last `n` day keys, oldest first, ending with `today`. */
export function lastDays(today: string, n: number): string[] {
  const days = [today];
  while (days.length < n) days.unshift(previousKey(days[0]));
  return days;
}
