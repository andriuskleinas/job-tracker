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
import { ChevronDown, ChevronRight } from "lucide-react";
import { ApplicationCard, type ApplicationCardData } from "@/components/ApplicationCard";
import {
  BOARD_COLUMNS,
  CLOSED_STATUSES,
  STATUSES,
  statusFill,
  statusLabel,
  type Status,
} from "@/lib/status";

/**
 * The pipeline as columns, with drag-to-advance.
 *
 * Why a board at all: the one action this product exists to support is moving
 * a role from one stage to the next, and until now that cost a navigation to
 * the detail page, a select, and a save. Here it costs a drag.
 *
 * Why only four columns: `rejected` and `withdrawn` are terminal and they only
 * ever accumulate, so as columns they would be two ever-lengthening dead ends
 * framing the four that matter — and on the axis where horizontal space is the
 * scarce resource. They live in one collapsed drawer at the end instead, which
 * is also an honest picture of their role in a job search: over, filed, still
 * countable.
 *
 * Why the board is not the only view: a board can only group by status, and
 * the questions a job hunt actually asks — what have I not touched in a month,
 * what is overdue, what is in Berlin — are list questions. See the list view,
 * which remains the default.
 */

/*
 * 220px, not the 280 a card would prefer.
 *
 * Four pipeline columns plus the closed drawer have to fit the page width the
 * rest of the app uses, and `minmax(0, 1fr)` silently ignores a min-width on
 * the child — which is how these first shipped at 190px each, narrower than
 * the cards they hold. The floor belongs in the track, so it is stated as
 * minmax(220px, 1fr) below and the board scrolls sideways only when even that
 * will not fit.
 */
const COLUMN_MIN = "220px";

/** Where a card can be dropped. Closed statuses are their own lanes. */
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
      // Hidden rather than removed: the column keeps its height, so the board
      // does not reflow under the cursor mid-drag.
      className={`touch-none ${isDragging ? "opacity-30" : ""}`}
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
      className={`rounded-lg transition-colors ${
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
  onTogglePriority,
  onMoveTo,
}: {
  status: Status;
  apps: ApplicationCardData[];
  dragging: boolean;
  onTogglePriority: (app: ApplicationCardData, priority: boolean) => void;
  onMoveTo: (app: ApplicationCardData, status: Status) => void;
}) {
  return (
    <section className="flex w-full min-w-0 flex-col" aria-label={statusLabel(status)}>
      <ColumnHeader status={status} count={apps.length} />
      <DropZone id={status} dragging={dragging} className="flex-1 p-1">
        <div className="grid gap-2">
          {apps.map((a) => (
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
        </div>
      </DropZone>
    </section>
  );
}

/**
 * The two terminal statuses, in one column, collapsed by default.
 *
 * Collapsed it is a count and a heading — enough to know the pile exists
 * without spending a screen on it. It splits into its two lanes whenever a
 * drag starts, because "this one is dead" is a drop people need to make often,
 * and asking them to expand a drawer first with a card already in hand would
 * be the one move the board made *harder* than the list it replaced.
 */
function ClosedColumn({
  byStatus,
  dragging,
  onTogglePriority,
  onMoveTo,
}: {
  byStatus: Record<Status, ApplicationCardData[]>;
  dragging: boolean;
  onTogglePriority: (app: ApplicationCardData, priority: boolean) => void;
  onMoveTo: (app: ApplicationCardData, status: Status) => void;
}) {
  const [open, setOpen] = useState(false);
  const total = CLOSED_STATUSES.reduce((n, s) => n + byStatus[s].length, 0);
  const showLanes = open || dragging;

  return (
    // Collapsed, this is a heading and a number, so it takes only the width
    // those need — a drawer nobody opened has no claim on a column's worth of
    // the board.
    <section
      className="flex flex-col"
      // Inline, not a Tailwind class: COLUMN_MIN is a runtime value and
      // Tailwind only generates classes it can read in the source text.
      style={showLanes ? { width: COLUMN_MIN, minWidth: COLUMN_MIN } : undefined}
      aria-label="Closed"
    >
      <div className="mb-2 flex items-center gap-2 px-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Closed
        </button>
        <span className="text-xs text-muted-foreground tabular-nums">{total}</span>
      </div>

      {showLanes ? (
        <div className="grid gap-3">
          {CLOSED_STATUSES.map((s) => (
            <div key={s}>
              <p className="mb-1 px-1 text-xs text-muted-foreground">
                {statusLabel(s)} <span className="tabular-nums">{byStatus[s].length}</span>
              </p>
              <DropZone id={s} dragging={dragging} className="p-1">
                <div className="grid gap-2">
                  {/* Collapsed-but-dragging shows the lanes as targets only —
                      the cards stay hidden, so the drop zone does not jump
                      down the page as it fills with history. */}
                  {open &&
                    byStatus[s].map((a) => (
                      <BoardCard
                        key={a.id}
                        app={a}
                        onTogglePriority={(priority) => onTogglePriority(a, priority)}
                        onMoveTo={(next) => onMoveTo(a, next)}
                      />
                    ))}
                  {(!open || byStatus[s].length === 0) && (
                    <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                      {dragging ? "Drop here" : "None"}
                    </p>
                  )}
                </div>
              </DropZone>
            </div>
          ))}
        </div>
      ) : null}
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

  // A card is also a link. Without a distance threshold every click would
  // begin a drag and no card would ever open.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byStatus = useMemo(() => {
    const groups = Object.fromEntries(
      STATUSES.map((s) => [s, [] as ApplicationCardData[]]),
    ) as Record<Status, ApplicationCardData[]>;
    for (const a of apps) groups[a.status].push(a);
    return groups;
  }, [apps]);

  const active = activeId ? apps.find((a) => a.id === activeId) : null;

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const target = event.over?.id as Status | undefined;
    if (!target) return;
    const app = apps.find((a) => a.id === event.active.id);
    if (!app || app.status === target) return;
    onMoveTo(app, target);
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
          style={{ gridTemplateColumns: `repeat(4, minmax(${COLUMN_MIN}, 1fr)) auto` }}
        >
          {BOARD_COLUMNS.map((s) => (
            <PipelineColumn
              key={s}
              status={s}
              apps={byStatus[s]}
              dragging={activeId !== null}
              onTogglePriority={onTogglePriority}
              onMoveTo={onMoveTo}
            />
          ))}
          <ClosedColumn
            byStatus={byStatus}
            dragging={activeId !== null}
            onTogglePriority={onTogglePriority}
            onMoveTo={onMoveTo}
          />
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
