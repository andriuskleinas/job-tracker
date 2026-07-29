export const STATUSES = ["applied", "interviewing", "offer", "rejected", "withdrawn"] as const;

export type Status = (typeof STATUSES)[number];

/**
 * Badge classes — shared by the applications list, detail page, and dashboard.
 *
 * Each status owns a hue, and the outcome hues are the ones people already
 * read without a legend:
 *
 *   applied      blue   in the pipeline, nothing owed
 *   interviewing amber  live and moving
 *   offer        green  the good outcome
 *   rejected     red    closed, not by you
 *   withdrawn    grey   closed, by you
 *
 * Tinted fill rather than solid: five solid blocks compete with the content,
 * and a tint leaves room for type that clears 4.5:1 (measured 5.9–7.8:1 in
 * both modes). Grey for `withdrawn` is deliberate — it is the one status that
 * should recede, so it is the one that gets no hue.
 *
 * The steps live in styles.css and were solved against colour-blind
 * simulation, not picked by eye; see the comment there before changing them.
 * Colour is never the only channel — every badge carries its own label.
 */
export const statusColor: Record<Status, string> = {
  applied: "border-transparent bg-[var(--status-applied-soft)] text-[var(--status-applied-text)]",
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
