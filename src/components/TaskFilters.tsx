import { useMemo } from "react";
import { Briefcase, CalendarClock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  activeTaskFilterCount,
  availableTaskRoles,
  DUE_WINDOW_LABEL,
  DUE_WINDOW_ORDER,
  hasActiveTaskFilters,
  type DueWindow,
  type TaskFilters as Filters,
  type TaskLike,
} from "@/lib/task-filters";
import { cn } from "@/lib/utils";

/** The count pill shown on an active filter trigger — same token as the board. */
function CountBadge({ n }: { n: number }) {
  return (
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand/15 px-1.5 text-xs font-medium tabular-nums text-brand-accent">
      {n}
    </span>
  );
}

/** Multi-select role picker — searchable, since a job hunt can carry many. */
function RoleFilter({
  roles,
  value,
  onChange,
}: {
  roles: ReturnType<typeof availableTaskRoles>;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  const label =
    value.length === 0
      ? "Role"
      : value.length === 1
        ? (roles.find((r) => r.id === value[0])?.position ?? "1 role")
        : `${value.length} roles`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("h-9 gap-2 font-normal", value.length > 0 && "border-brand/50")}
        >
          <span
            className={cn(
              "flex items-center gap-2 truncate",
              value.length === 0 && "text-muted-foreground",
            )}
          >
            <Briefcase className="h-4 w-4 shrink-0 opacity-60" />
            <span className="max-w-40 truncate">{label}</span>
          </span>
          {value.length > 0 && <CountBadge n={value.length} />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Search roles…" />
          <CommandList>
            <CommandEmpty>No roles found.</CommandEmpty>
            <CommandGroup>
              {roles.map((r) => (
                <CommandItem
                  key={r.id}
                  value={`${r.position} ${r.company}`}
                  onSelect={() => toggle(r.id)}
                >
                  <Checkbox
                    checked={value.includes(r.id)}
                    tabIndex={-1}
                    className="pointer-events-none"
                  />
                  <span className="truncate">
                    {r.position} <span className="text-muted-foreground">· {r.company}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Multi-select due-window picker, mirroring the board's StatusFilter. */
function DueFilter({
  value,
  onChange,
}: {
  value: DueWindow[];
  onChange: (next: DueWindow[]) => void;
}) {
  const toggle = (w: DueWindow) =>
    onChange(value.includes(w) ? value.filter((x) => x !== w) : [...value, w]);

  const label =
    value.length === 0
      ? "Due"
      : value.length === 1
        ? DUE_WINDOW_LABEL[value[0]]
        : `${value.length} windows`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("h-9 gap-2 font-normal", value.length > 0 && "border-brand/50")}
        >
          <span
            className={cn(
              "flex items-center gap-2 truncate",
              value.length === 0 && "text-muted-foreground",
            )}
          >
            <CalendarClock className="h-4 w-4 shrink-0 opacity-60" />
            <span className="truncate">{label}</span>
          </span>
          {value.length > 0 && <CountBadge n={value.length} />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-1.5">
        {DUE_WINDOW_ORDER.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => toggle(w)}
            className="flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Checkbox checked={value.includes(w)} tabIndex={-1} className="pointer-events-none" />
            {DUE_WINDOW_LABEL[w]}
          </button>
        ))}
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="mt-1 flex w-full items-center gap-1.5 border-t px-2 pb-1 pt-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> Clear windows
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * The Tasks page filter controls — role, due window, and a hide-completed
 * toggle — built from the same pill controls, count badges, and Clear
 * affordance as the applications board so the two lists read as one product.
 *
 * Returns a bare group of controls (no wrapper) so the route can drop them into
 * the header alongside the list/grid toggle; the "Showing X of Y" summary lives
 * next to the list itself. Fully controlled: the route owns the state and
 * passes down a single patch callback.
 */
export function TaskFilters({
  tasks,
  value,
  onChange,
  onClear,
}: {
  tasks: TaskLike[];
  value: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
}) {
  const roleOptions = useMemo(() => availableTaskRoles(tasks), [tasks]);
  const active = hasActiveTaskFilters(value);

  return (
    <>
      {roleOptions.length > 0 && (
        <RoleFilter
          roles={roleOptions}
          value={value.roleIds}
          onChange={(roleIds) => onChange({ roleIds })}
        />
      )}

      <DueFilter value={value.due} onChange={(due) => onChange({ due })} />

      <Button
        variant="outline"
        onClick={() => onChange({ hideCompleted: !value.hideCompleted })}
        className={cn("h-9 gap-2 font-normal", value.hideCompleted && "border-brand/50")}
      >
        <Checkbox checked={value.hideCompleted} tabIndex={-1} className="pointer-events-none" />
        <span className={cn(!value.hideCompleted && "text-muted-foreground")}>Hide completed</span>
      </Button>

      {active && (
        <Button variant="ghost" onClick={onClear} className="h-9 text-muted-foreground">
          <X className="h-4 w-4" /> Clear
          <span className="ml-0.5 rounded-full bg-muted px-1.5 text-xs tabular-nums">
            {activeTaskFilterCount(value)}
          </span>
        </Button>
      )}
    </>
  );
}
