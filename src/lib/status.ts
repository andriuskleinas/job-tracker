export const STATUSES = ["applied", "interviewing", "offer", "rejected", "withdrawn"] as const;

export type Status = (typeof STATUSES)[number];

/**
 * Badge classes — shared by the applications list, detail page, and dashboard.
 *
 * The palette is black / white / grey / red, so these cannot be told apart by
 * hue the way a five-colour scale would. Each status is separated by *fill and
 * border style* instead, which also survives greyscale and every form of
 * colour blindness:
 *
 *   applied      filled grey    in the pipeline, nothing owed
 *   interviewing solid black    live and moving
 *   offer        solid red      the one result worth spotting across a page
 *   rejected     outlined grey  closed
 *   withdrawn    dashed grey    closed, by you
 *
 * Red goes to `offer` rather than `rejected` on purpose: the accent marks what
 * deserves attention, and a rejection needs none.
 */
export const statusColor: Record<Status, string> = {
  applied: "border-transparent bg-muted text-foreground",
  interviewing: "border-transparent bg-foreground text-background",
  offer: "border-transparent bg-brand text-brand-foreground",
  rejected: "border-border bg-transparent text-muted-foreground",
  withdrawn: "border-dashed border-border bg-transparent text-muted-foreground",
};

/** Statuses that still represent a live opportunity. */
export const ACTIVE_STATUSES: readonly Status[] = ["applied", "interviewing"];
