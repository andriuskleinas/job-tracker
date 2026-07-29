export const STATUSES = ["applied", "interviewing", "offer", "rejected", "withdrawn"] as const;

export type Status = (typeof STATUSES)[number];

/** Badge classes — shared by the applications list, detail page, and dashboard. */
export const statusColor: Record<Status, string> = {
  applied: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  interviewing: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  offer: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  rejected: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  withdrawn: "bg-muted text-muted-foreground",
};

/** Statuses that still represent a live opportunity. */
export const ACTIVE_STATUSES: readonly Status[] = ["applied", "interviewing"];
