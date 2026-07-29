import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type RoleOption = { id: string; company: string; position: string };

/**
 * Multi-select for assigning a task to one or more roles (applications).
 * The same task can be attached to any number of roles, so this is a
 * checkbox-style picker rather than a single-value select.
 */
export function RoleMultiSelect({
  roles,
  selected,
  onChange,
  placeholder = "Assign to roles…",
}: {
  roles: RoleOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedRoles = roles.filter((r) => selected.includes(r.id));

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="truncate text-left text-muted-foreground">
              {selectedRoles.length > 0
                ? `${selectedRoles.length} role${selectedRoles.length === 1 ? "" : "s"} selected`
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search roles…" />
            <CommandList>
              <CommandEmpty>No roles found.</CommandEmpty>
              <CommandGroup>
                {roles.map((r) => {
                  const isSelected = selected.includes(r.id);
                  return (
                    <CommandItem
                      key={r.id}
                      value={`${r.position} ${r.company}`}
                      onSelect={() => toggle(r.id)}
                    >
                      <Check className={cn("h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                      <span className="truncate">
                        {r.position} <span className="text-muted-foreground">· {r.company}</span>
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedRoles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedRoles.map((r) => (
            <Badge key={r.id} variant="secondary" className="gap-1 pr-1 font-normal">
              {r.position} · {r.company}
              <button
                type="button"
                onClick={() => toggle(r.id)}
                aria-label={`Remove ${r.position} at ${r.company}`}
                className="rounded-sm opacity-70 hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
