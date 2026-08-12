import { useMemo, useState } from "react";
import { SlidersHorizontal, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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

/** The count pill shown on the active filter trigger — same token as the board. */
function CountBadge({ n }: { n: number }) {
  return (
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand/15 px-1.5 text-xs font-medium tabular-nums text-brand-accent">
      {n}
    </span>
  );
}

/** A checkbox row inside the filter panel. */
function CheckRow({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
    >
      <Checkbox checked={checked} tabIndex={-1} className="pointer-events-none shrink-0" />
      {children}
    </button>
  );
}

/**
 * The Tasks page filter controls — role, due window, high-priority, and
 * hide-completed — collapsed behind a single filter icon. Clicking it opens one
 * panel holding every filter, so the header stays a single tidy control while
 * the full set is a click away. An active count rides on the trigger.
 *
 * Everything lives in one Popover (no nested popovers), so toggling several
 * filters in a row keeps the panel open. Fully controlled: the route owns the
 * state and passes down a single patch callback.
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
  const count = activeTaskFilterCount(value);
  // Roles only appear once you search, so the panel stays short by default.
  const [roleSearch, setRoleSearch] = useState("");

  const toggleRole = (id: string) =>
    onChange({
      roleIds: value.roleIds.includes(id)
        ? value.roleIds.filter((x) => x !== id)
        : [...value.roleIds, id],
    });
  const toggleDue = (w: DueWindow) =>
    onChange({ due: value.due.includes(w) ? value.due.filter((x) => x !== w) : [...value.due, w] });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label="Filter tasks"
          className={cn("gap-1.5", active && "border-brand/50")}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {count > 0 && <CountBadge n={count} />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-sm font-medium">Filters</span>
          {active && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" /> Clear
              <span className="ml-0.5 rounded-full bg-muted px-1.5 tabular-nums">{count}</span>
            </button>
          )}
        </div>

        {roleOptions.length > 0 && (
          <>
            <Separator />
            <div className="px-1.5 py-2">
              <p className="px-1.5 pb-1 text-xs font-medium text-muted-foreground">Role</p>
              <Command>
                <CommandInput
                  value={roleSearch}
                  onValueChange={setRoleSearch}
                  placeholder="Search roles…"
                  className="h-8"
                />
                {roleSearch.trim() && (
                  <CommandList className="max-h-40">
                    <CommandEmpty>No roles found.</CommandEmpty>
                    <CommandGroup>
                      {roleOptions.map((r) => (
                        <CommandItem
                          key={r.id}
                          value={`${r.position} ${r.company}`}
                          onSelect={() => toggleRole(r.id)}
                        >
                          <Checkbox
                            checked={value.roleIds.includes(r.id)}
                            tabIndex={-1}
                            className="pointer-events-none"
                          />
                          <span className="truncate">
                            {r.position}{" "}
                            <span className="text-muted-foreground">· {r.company}</span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                )}
              </Command>
            </div>
          </>
        )}

        <Separator />
        <div className="px-1.5 py-2">
          <p className="px-1.5 pb-1 text-xs font-medium text-muted-foreground">Due</p>
          {DUE_WINDOW_ORDER.map((w) => (
            <CheckRow key={w} checked={value.due.includes(w)} onToggle={() => toggleDue(w)}>
              {DUE_WINDOW_LABEL[w]}
            </CheckRow>
          ))}
        </div>

        <Separator />
        <div className="px-1.5 py-2">
          <CheckRow
            checked={value.highPriorityOnly}
            onToggle={() => onChange({ highPriorityOnly: !value.highPriorityOnly })}
          >
            <Star
              className={cn(
                "h-4 w-4 shrink-0",
                value.highPriorityOnly
                  ? "fill-[var(--status-interviewing-text)] text-[var(--status-interviewing-text)]"
                  : "text-muted-foreground",
              )}
            />
            High priority
          </CheckRow>
          <CheckRow
            checked={value.hideCompleted}
            onToggle={() => onChange({ hideCompleted: !value.hideCompleted })}
          >
            Hide completed
          </CheckRow>
        </div>
      </PopoverContent>
    </Popover>
  );
}
