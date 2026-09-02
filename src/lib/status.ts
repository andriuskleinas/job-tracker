export const STATUSES = [
  "wishlist",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
] as const;

export type Status = (typeof STATUSES)[number];

/**
 * Badge classes — shared by the applications list, detail page, and dashboard.
 *
 * Six statuses, six marks, and only two of them spend a hue:
 *
 *   wishlist     slate  saved, not applied to yet
 *   applied      ink    in the pipeline, nothing owed
 *   interviewing gold   live and moving
 *   offer        green  the good outcome
 *   rejected     red    closed, not by you
 *   withdrawn    grey   closed, by you
 *
 * Tinted fill rather than solid: five solid blocks compete with the content,
 * and a tint leaves room for type that clears 4.5:1 (measured 5.9–7.8:1 in
 * both modes).
 *
 * `wishlist`, `applied` and `withdrawn` are all neutral, so the badge cannot
 * lean on hue to tell them apart and leans on fill and edge instead:
 *
 *   wishlist   no fill, dashed slate border, mid-slate type — a broken
 *              outline, a role you have only bookmarked
 *   applied    no fill at all, ink border, near-black type — an open outline,
 *              the row still yours to act on
 *   withdrawn  flat grey fill, mid-grey type, no edge — closed, receding
 *
 * Edge means open, fill means closed, a broken edge means not yet committed.
 * `wishlist` sits one notch quieter than `applied` on every channel it has,
 * which is right: it is a job you have not acted on, so it should not compete
 * with the ones you have.
 *
 * Neither `wishlist` nor `applied` is filled, and that is deliberate on two
 * counts. It is the status roughly six rows in ten carry, so a fill —
 * solid black most of all — would make the least informative state the
 * loudest mark on the board and let gold and green lose a fight they must
 * win: the eye belongs on the two rows that need something today, not the
 * seven where nothing has happened. An earlier version tinted it faintly
 * instead, which failed the other way — it read as washed out, and sat too
 * close to `withdrawn`, so open and dead work looked alike. An outline is
 * the shape that is emphatic without being heavy.
 *
 * The steps live in styles.css and were solved against colour-blind
 * simulation, not picked by eye; see the comment there before changing them.
 * Colour is never the only channel — every badge carries its own label.
 */
export const statusColor: Record<Status, string> = {
  wishlist:
    "border-dashed border-[var(--status-wishlist)] bg-transparent text-[var(--status-wishlist-text)]",
  applied: "border-[var(--status-applied)] bg-transparent text-[var(--status-applied-text)]",
  interviewing:
    "border-transparent bg-[var(--status-interviewing-soft)] text-[var(--status-interviewing-text)]",
  offer: "border-transparent bg-[var(--status-offer-soft)] text-[var(--status-offer-text)]",
  rejected:
    "border-transparent bg-[var(--status-rejected-soft)] text-[var(--status-rejected-text)]",
  withdrawn:
    "border-transparent bg-[var(--status-withdrawn-soft)] text-[var(--status-withdrawn-text)]",
};

/**
 * Chart fills for the same six statuses. Charts need the solid mark colour
 * rather than the badge tint, but it is the same hue in the same slot, so a
 * red bar and a red badge always mean the one thing.
 */
export const statusFill: Record<Status, string> = {
  wishlist: "var(--status-wishlist)",
  applied: "var(--status-applied)",
  interviewing: "var(--status-interviewing)",
  offer: "var(--status-offer)",
  rejected: "var(--status-rejected)",
  withdrawn: "var(--status-withdrawn)",
};

/**
 * Statuses that still represent a live opportunity.
 *
 * `wishlist` is excluded. It reads like it belongs — a saved job is certainly
 * not dead — but this list drives the "Stalled" pill, whose meaning is *an
 * application you sent and then heard nothing about*. A bookmark that has sat
 * untouched for a month is not stalled; it is a bookmark. Including it would
 * put a warning on every job the extension clipped and never acted on, which
 * is most of them, and a warning that fires on the common case stops being
 * read.
 */
export const ACTIVE_STATUSES: readonly Status[] = ["applied", "interviewing"];

/**
 * Statuses that are history, not pipeline. These recede on the board so live
 * opportunities carry the visual weight. `offer` is deliberately excluded — it
 * is a closed loop, but the good one, so it should stand out rather than fade.
 */
export const CLOSED_STATUSES: readonly Status[] = ["rejected", "withdrawn"];

/**
 * Statuses that mean the user actually sent an application.
 *
 * `wishlist` is the whole reason this predicate exists. Every funnel on the
 * dashboard divides by "applications", and until `wishlist` existed that was
 * simply every row — true, because there was no way to record a job you had
 * only bookmarked. A saved posting is not an application, so counting one
 * dilutes every rate the dashboard reports: clip ten interesting jobs on a
 * Sunday and your interview rate halves without you doing anything wrong.
 */
export function hasApplied(status: Status): boolean {
  return status !== "wishlist";
}

/**
 * Board column order: the pipeline as it is actually walked.
 *
 * `rejected` and `withdrawn` are missing on purpose — they are terminal and
 * they only ever accumulate, so as columns they would be two ever-growing
 * dead ends flanking the four that matter. They live behind CLOSED_STATUSES
 * in a single collapsed column instead.
 */
export const BOARD_COLUMNS: readonly Status[] = ["wishlist", "applied", "interviewing", "offer"];

/** Sentence-case label for a status, for column headers and legends. */
export function statusLabel(status: Status): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}
