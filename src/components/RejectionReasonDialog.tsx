import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EMPTY_REJECTION,
  REJECTION_NOTE_MAX,
  REJECTION_TAGS,
  rejectionTagLabel,
  type RejectionReason,
} from "@/lib/rejection";

/**
 * Asks why an application was rejected, at the moment it becomes rejected.
 *
 * Three ways out, and they mean different things. "Save" records the reason
 * and goes ahead. "Skip" goes ahead with no reason — a rejection with no
 * explanation is the common case and must never be harder to log than one
 * with. Closing the dialog (Escape, the ×, a click outside) cancels the status
 * change entirely, because that is what dismissing a question about an action
 * usually means.
 *
 * Tags are toggle chips and any number can be on at once; the note is
 * independent of them, so tag-only, note-only and both all work.
 */
export function RejectionReasonDialog({
  open,
  onOpenChange,
  subject,
  initial = EMPTY_REJECTION,
  onSave,
  onSkip,
}: {
  open: boolean;
  /** Closing without choosing Save or Skip — the caller treats it as cancel. */
  onOpenChange: (open: boolean) => void;
  /** e.g. "Product Designer at Acme", shown under the title. */
  subject?: string;
  initial?: RejectionReason;
  onSave: (reason: RejectionReason) => void;
  /** Omit to hide the Skip button (e.g. when editing an existing reason). */
  onSkip?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // The card menu that opens this lives inside a Link and a draggable
        // card; a press inside the dialog must claim neither.
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Remounted on every open so the form is re-seeded from `initial`. */}
        {open && <ReasonForm subject={subject} initial={initial} onSave={onSave} onSkip={onSkip} />}
      </DialogContent>
    </Dialog>
  );
}

function ReasonForm({
  subject,
  initial,
  onSave,
  onSkip,
}: {
  subject?: string;
  initial: RejectionReason;
  onSave: (reason: RejectionReason) => void;
  onSkip?: () => void;
}) {
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [note, setNote] = useState(initial.note);

  const toggle = (key: string) =>
    setTags((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  // Keys saved by another build (or since retired) stay selectable so editing
  // a reason never silently drops one.
  const known = REJECTION_TAGS.map((t) => t.key as string);
  const options = [
    ...REJECTION_TAGS.map((t) => ({ key: t.key as string, label: t.label })),
    ...initial.tags
      .filter((k) => !known.includes(k))
      .map((k) => ({ key: k, label: rejectionTagLabel(k) })),
  ];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ tags, note });
      }}
      className="space-y-4"
    >
      <DialogHeader>
        <DialogTitle>Why was it rejected?</DialogTitle>
        <DialogDescription>
          {subject ? `${subject} — ` : ""}pick any that apply, add your own words, or skip.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Rejection reasons">
        {options.map((t) => {
          const on = tags.includes(t.key);
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(t.key)}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none ${
                on
                  ? "border-transparent bg-[var(--status-rejected-soft)] text-[var(--status-rejected-text)]"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {on && <Check className="h-3.5 w-3.5" />}
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <Label htmlFor="rejection_note">In your own words (optional)</Label>
        <Textarea
          id="rejection_note"
          rows={3}
          maxLength={REJECTION_NOTE_MAX}
          placeholder="e.g. They wanted someone with fintech experience"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <DialogFooter className="gap-2 sm:gap-2">
        {onSkip && (
          <Button type="button" variant="ghost" onClick={onSkip}>
            Skip
          </Button>
        )}
        <Button type="submit">Save reason</Button>
      </DialogFooter>
    </form>
  );
}
