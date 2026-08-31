export const STATUSES = ["applied", "interviewing", "offer", "rejected", "withdrawn"] as const;

export type Status = (typeof STATUSES)[number];

/**
 * Badge classes — shared by the applications list, detail page, and dashboard.
 *
 * Five statuses, five marks, and only two of them spend a hue:
 *
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
 * `applied` and `withdrawn` are both neutral, so the badge cannot lean on hue
 * to tell them apart and leans on fill and edge instead — inverses of each
 * other, which is the point:
 *
 *   applied    no fill at all, ink border, near-black type — an open outline,
 *              the row still yours to act on
 *   withdrawn  flat grey fill, mid-grey type, no edge — closed, receding
 *
 * `applied` is the only unfilled badge in the set, and that is deliberate on
 * two counts. It is the status roughly six rows in ten carry, so a fill —
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
 * Chart fills for the same five statuses. Charts need the solid mark colour
 * rather than the badge tint, but it is the same hue in the same slot, so a
 * red bar and a red badge always mean the one thing.
 */
export const statusFill: Record<Status, string> = {
  applied: "var(--status-applied)",
  interviewing: "var(--status-interviewing)",
  offer: "var(--status-offer)",
  rejected: "var(--status-rejected)",
  withdrawn: "var(--status-withdrawn)",
};

/** Statuses that still represent a live opportunity. */
export const ACTIVE_STATUSES: readonly Status[] = ["applied", "interviewing"];

/**
 * Statuses that are history, not pipeline. These recede on the board so live
 * opportunities carry the visual weight. `offer` is deliberately excluded — it
 * is a closed loop, but the good one, so it should stand out rather than fade.
 */
export const CLOSED_STATUSES: readonly Status[] = ["rejected", "withdrawn"];
