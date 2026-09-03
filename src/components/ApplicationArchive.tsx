import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ApplicationCard, type ApplicationCardData } from "@/components/ApplicationCard";

/**
 * Rejected and withdrawn applications, held at the bottom of the page rather
 * than mixed in with the ones still moving.
 *
 * Every other view on this page — list, grid, board — now shows only the
 * live pipeline; a closed application has exactly one home, this one,
 * regardless of which of those three the user has open. Collapsed by
 * default: the record is meant to be reachable, not to compete for attention
 * with the applications a person is actually acting on today. Opening it is
 * one click, and every row underneath is the same card used everywhere else
 * in the app, so "click and go through" works exactly like it does anywhere
 * else — it's a link to the full application.
 */
export function ApplicationArchive({
  apps,
  onTogglePriority,
}: {
  apps: ApplicationCardData[];
  onTogglePriority: (app: ApplicationCardData, priority: boolean) => void;
}) {
  const [open, setOpen] = useState(false);

  if (apps.length === 0) return null;

  return (
    <section className="mt-8 border-t pt-6" aria-label="Archive">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Archive
        <span className="tabular-nums">{apps.length}</span>
      </button>
      <p className="mt-1 text-xs text-muted-foreground">
        Applications you're no longer pursuing — rejected or withdrawn.
      </p>
      {open && (
        <div className="mt-4 grid gap-3">
          {apps.map((a) => (
            <ApplicationCard
              key={a.id}
              app={a}
              variant="list"
              onTogglePriority={(priority) => onTogglePriority(a, priority)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
