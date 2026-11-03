/**
 * Why an application ended in `rejected`.
 *
 * Tags are stored by key, not label, so a label can be reworded here without
 * rewriting rows. A key the app no longer knows (or one written by an older
 * build) still renders — as itself — rather than vanishing.
 */
export const REJECTION_TAGS = [
  { key: "auto_reply", label: "Auto-reply rejection" },
  { key: "ghosted", label: "Ghosted" },
  { key: "failed_interview", label: "Didn't pass interview" },
  { key: "position_filled", label: "Position filled" },
  { key: "overqualified", label: "Overqualified" },
  { key: "underqualified", label: "Underqualified" },
  { key: "salary_mismatch", label: "Salary mismatch" },
  { key: "location", label: "Location / visa" },
  { key: "role_cancelled", label: "Role cancelled" },
] as const;

export const REJECTION_NOTE_MAX = 1000;

export type RejectionReason = { tags: string[]; note: string };

export const EMPTY_REJECTION: RejectionReason = { tags: [], note: "" };

export function rejectionTagLabel(key: string): string {
  return REJECTION_TAGS.find((t) => t.key === key)?.label ?? key;
}

export function rejectionFromRow(row: {
  rejection_reason_tags?: string[] | null;
  rejection_note?: string | null;
}): RejectionReason {
  return { tags: row.rejection_reason_tags ?? [], note: row.rejection_note ?? "" };
}

/** The columns to write. An empty note is stored as null, never "". */
export function rejectionColumns(reason: RejectionReason) {
  const note = reason.note.trim().slice(0, REJECTION_NOTE_MAX);
  return { rejection_reason_tags: reason.tags, rejection_note: note || null };
}

export function hasRejectionReason(reason: RejectionReason): boolean {
  return reason.tags.length > 0 || reason.note.trim().length > 0;
}
