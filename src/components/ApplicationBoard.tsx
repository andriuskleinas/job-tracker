import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ApplicationCard, type ApplicationCardData } from "@/components/ApplicationCard";
import { BOARD_COLUMNS, statusFill, statusLabel, type Status } from "@/lib/status";

/**
 * The pipeline as columns, with drag-to-advance.
 *
 * Why a board at all: the one action this product exists to support is moving
 * a role from one stage to the next, and until now that cost a navigation to
 * the detail page, a select, and a save. Here it costs a drag.
 *
 * Why only four columns: `rejected` and `withdrawn` are done, and a person
 * looking at their pipeline is not looking for the roles they are no longer
 * pursuing. This board does not render them at all — no column, no drawer —
 * so a rejection leaves the board rather than sinking to the bottom of it.
 * They are not gone from the product: the caller keeps a small reference link
 * to them for the record, just not inside the pipeline. Moving a card *to*
 * one of those statuses is still one tab away, in the move menu on the card —
 * there just isn't a column to drag it into any more.
 *
 * Why the board is not the only view: a board can only group by status, and
 * the questions a job hunt actually asks — what have I not touched in a month,
 * what is overdue, what is in Berlin — are list questions. See the list view,
 * which remains the default.
 */

/*
 * 220px, not the 280 a card would prefer.
 *
 * The four pipeline columns have to fit the page width the rest of the app
 * uses, and `minmax(0, 1fr)` silently ignores a min-width on the child —
 * which is how these first shipped at 190px each, narrower than the cards
 * they hold. The floor belongs in the track, so it is stated as
 * minmax(220px, 1fr) below and the board scrolls sideways only when even that
 * will not fit.
 */
const COLUMN_MIN = "220px";

/**
 * How many cards a column shows before it offers the rest behind a button.
 *
 * A job search is shaped like a funnel that never empties at the top: `applied`
 * holds most of the board most of the time, and left uncapped it grows into a
 * single column several screens long while the three beside it end a few
 * hundred pixels down. At that point the board has stopped being a board — it
 * is the list view again, with three narrow margins.
 *
 * Five keeps the four columns comparable in height, which is the comparison
 * the layout exists to make. It is not an arbitrary truncation either: the
 * parent sorts starred roles first and newest next, so the five a column keeps
 * are the five most worth seeing.
 */
const COLUMN_PREVIEW_COUNT = 5;

/** Where a card can be dropped: one of the four pipeline statuses. */
type DropId = Status;

function columnAccent(status: Status): string {
  return statusFill[status];
}

/* ------------------------------------------------------------------ *
 * Draggable card
 * ------------------------------------------------------------------ */

function BoardCard({
  app,
  onTogglePriority,
  onMoveTo,
}: {
  app: ApplicationCardData;
  onTogglePriority: (priority: boolean) => void;
  onMoveTo: (status: Status) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: app.id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      // The card underneath is a link and the star and move menu are buttons,
      // so this wrapper must not also announce itself as a control. dnd-kit's
      // own announcements cover the drag; the move menu covers keyboard.
      role={undefined}
      tabIndex={undefined}
      // min-w-0 is load-bearing, not defensive. A grid item defaults to
      // min-width:auto, which resolves to min-content, and this card's
      // min-content is its longest unbreakable run: the title is `truncate`,
      // so white-space:nowrap makes its min-content the *whole* string, and
      // the location pills cannot break internally either. Without this the
      // card refuses to shrink to its column — measured 270px inside a 220px
      // track — and, since nothing clips it, spills over and paints on top of
      // the next column's cards.
      //
      // Hidden rather than removed while dragging: the column keeps its
      // height, so the board does not reflow under the cursor mid-drag.
      className={`min-w-0 touch-none ${isDragging ? "opacity-30" : ""}`}
    >
      <ApplicationCard
        app={app}
        variant="board"
        onTogglePriority={onTogglePriority}
        onMoveTo={onMoveTo}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Columns
 * ------------------------------------------------------------------ */

/**
 * A drop target. `dragging` widens the visual affordance while a drag is in
 * flight — a dashed edge that only appears when it is actionable, rather than
 * four permanently outlined boxes.
 */
function DropZone({
  id,
  dragging,
  className = "",
  children,
}: {
  id: DropId;
  dragging: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`min-w-0 rounded-lg transition-colors ${
        dragging ? "border border-dashed" : "border border-transparent"
      } ${isOver ? "border-foreground/30 bg-accent/50" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

function ColumnHeader({ status, count }: { status: Status; count: number }) {
  return (
    <div className="mb-2 flex items-center gap-2 px-1">
      {/* The column's own status mark, at the one size a 3px rule survives.
          The label does the work; this just ties the column to the badge
          vocabulary used everywhere else. */}
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: columnAccent(status) }}
      />
      <h3 className="text-sm font-medium">{statusLabel(status)}</h3>
      <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
    </div>
  );
}

function PipelineColumn({
  status,
  apps,
  dragging,
  lastMovedId,
  onTogglePriority,
  onMoveTo,
}: {
  status: Status;
  apps: ApplicationCardData[];
  dragging: boolean;
  /** The card most recently moved, so a column cannot swallow it. */
  lastMovedId: string | null;
  onTogglePriority: (app: ApplicationCardData, priority: boolean) => void;
  onMoveTo: (app: ApplicationCardData, status: Status) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // A card dropped into a collapsed column can sort below the cut, and a drop
  // that appears to do nothing is worse than a long column. When that happens
  // the column opens itself rather than swallowing the card. Derived, not an
  // effect: it is a fact about this render, and storing it would leave the
  // column stuck open after the next move elsewhere.
  const movedBelowCut = apps.findIndex((a) => a.id === lastMovedId) >= COLUMN_PREVIEW_COUNT;
  const showAll = expanded || movedBelowCut;
  const visible = showAll ? apps : apps.slice(0, COLUMN_PREVIEW_COUNT);
  const hidden = apps.length - visible.length;

  return (
    <section className="flex w-full min-w-0 flex-col" aria-label={statusLabel(status)}>
      <ColumnHeader status={status} count={apps.length} />
      <DropZone id={status} dragging={dragging} className="flex-1 p-1">
        <div className="grid gap-2">
          {visible.map((a) => (
            <BoardCard
              key={a.id}
              app={a}
              onTogglePriority={(priority) => onTogglePriority(a, priority)}
              onMoveTo={(next) => onMoveTo(a, next)}
            />
          ))}
          {apps.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              {dragging ? "Drop here" : "Nothing here yet"}
            </p>
          )}
          {(hidden > 0 || (showAll && apps.length > COLUMN_PREVIEW_COUNT)) && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              // The count goes in the label rather than a bare "Show more":
              // how much more is the thing you want to know before deciding
              // whether to spend the scroll.
              className="rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {hidden > 0 ? `Show ${hidden} more` : "Show less"}
            </button>
          )}
        </div>
      </DropZone>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Board
 * ------------------------------------------------------------------ */

export function ApplicationBoard({
  apps,
  onTogglePriority,
  onMoveTo,
}: {
  apps: ApplicationCardData[];
  onTogglePriority: (app: ApplicationCardData, priority: boolean) => void;
  onMoveTo: (app: ApplicationCardData, status: Status) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lastMovedId, setLastMovedId] = useState<string | null>(null);

  // A card is also a link. Without a distance threshold every click would
  // begin a drag and no card would ever open.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Grouped over the four pipeline statuses only. A closed application in
  // `apps` simply has nowhere to land here — that omission is the whole
  // mechanism by which it leaves the board; see the module doc above.
  const byStatus = useMemo(() => {
    const groups = Object.fromEntries(
      BOARD_COLUMNS.map((s) => [s, [] as ApplicationCardData[]]),
    ) as Record<Status, ApplicationCardData[]>;
    for (const a of apps) {
      if (a.status in groups) groups[a.status].push(a);
    }
    return groups;
  }, [apps]);

  const active = activeId ? apps.find((a) => a.id === activeId) : null;

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const target = event.over?.id as Status | undefined;
    if (!target) return;
    const app = apps.find((a) => a.id === event.active.id);
    if (!app || app.status === target) return;
    setLastMovedId(app.id);
    onMoveTo(app, target);
  };

  // The move menu is the other way a card changes column, and it owes the
  // destination the same guarantee the drag does.
  const handleMoveTo = (app: ApplicationCardData, status: Status) => {
    setLastMovedId(app.id);
    onMoveTo(app, status);
  };

  return (
    <DndContext
      sensors={sensors}
      // pointerWithin over the default rectangle intersection: columns are tall
      // and cards are small, so "which column is the cursor in" is the question
      // being asked, not "which column does this card overlap most".
      collisionDetection={pointerWithin}
      // dnd-kit's default announcement offers a keyboard lift with the space
      // bar. This board does not have one: the cards are links, and making
      // each also a focusable draggable would put two tab stops on every card
      // and shadow Enter-to-open. The "Move to" menu on each card is the
      // keyboard route instead, so say that rather than describing a gesture
      // that is not there.
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Drag a card to another column to change its status. Without a pointer, use the move button on the card to pick a new status from a menu.",
        },
      }}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
    >
      <div className="overflow-x-auto pb-2">
        <div
          className="grid gap-4 md:items-start"
          style={{ gridTemplateColumns: `repeat(4, minmax(${COLUMN_MIN}, 1fr))` }}
        >
          {BOARD_COLUMNS.map((s) => (
            <PipelineColumn
              key={s}
              status={s}
              apps={byStatus[s]}
              dragging={activeId !== null}
              lastMovedId={lastMovedId}
              onTogglePriority={onTogglePriority}
              onMoveTo={handleMoveTo}
            />
          ))}
        </div>
      </div>

      {/* The dragged card rides the cursor at full opacity while its origin
          slot dims — the standard cue that this is a move, not a copy. */}
      <DragOverlay dropAnimation={null}>
        {active ? (
          <div className="w-[280px] rotate-1 opacity-95 shadow-lg">
            <ApplicationCard app={active} variant="board" onTogglePriority={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
