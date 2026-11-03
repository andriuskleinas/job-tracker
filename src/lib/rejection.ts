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

export type RejectionFields = {
  status: string;
  rejection_reason_tags?: string[] | null;
  rejection_note?: string | null;
};

export type RejectionSummary = {
  /** Applications currently rejected. */
  rejected: number;
  /** Of those, how many carry a tag or a note. */
  withReason: number;
  /** Most common first; ties alphabetical by label so the order is stable. */
  tags: { key: string; label: string; count: number }[];
  words: { word: string; count: number }[];
};

/*
 * Words that say nothing about why on their own. Kept short on purpose — a
 * note is a sentence or two, and over-filtering it leaves nothing to show.
 */
const STOPWORDS = new Set(
  (
    "the and but for not was were are with that this they them their there then than " +
    "have has had been being from into onto out about after before over under again " +
    "just only also very really too much more most some any all one two can could would " +
    "should will did does doing done got get its it's i'm i've you your our ours what " +
    "which who whom when where why how because while until though even still like " +
    "my me we he she his her him us an a of to in on at by or is as be so if no it i"
  ).split(" "),
);

/** Up to this many words appear in the notes cloud. */
export const NOTE_WORDS_MAX = 24;

/**
 * Counts the reasons behind current rejections.
 *
 * Note words are counted once per note, not per occurrence — the cloud should
 * say how many rejections mention "salary", not how often one long note
 * repeats it.
 */
export function summarizeRejections(apps: RejectionFields[]): RejectionSummary {
  const rejected = apps.filter((a) => a.status === "rejected");
  const tagCounts = new Map<string, number>();
  const wordCounts = new Map<string, number>();
  let withReason = 0;

  for (const app of rejected) {
    const reason = rejectionFromRow(app);
    if (hasRejectionReason(reason)) withReason += 1;
    for (const key of new Set(reason.tags)) tagCounts.set(key, (tagCounts.get(key) ?? 0) + 1);
    for (const word of noteWords(reason.note))
      wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
  }

  const tags = [...tagCounts]
    .map(([key, count]) => ({ key, label: rejectionTagLabel(key), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const words = [...wordCounts]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, NOTE_WORDS_MAX);

  return { rejected: rejected.length, withReason, tags, words };
}

function noteWords(note: string): Set<string> {
  const words = note.toLowerCase().match(/[\p{L}][\p{L}'’-]*/gu) ?? [];
  return new Set(
    words
      .map((w) => w.replace(/['’-]+$/, "").replace(/’/g, "'"))
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}
