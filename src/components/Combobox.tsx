import * as React from "react";
import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type ComboboxOption = {
  /** The stored value and what selection compares against. */
  value: string;
  /** Shown as the main label in the list and trigger. */
  label: string;
  /** Muted secondary text on the right of a row (e.g. a city's country). */
  hint?: string;
  /** Extra words folded into search matching. Defaults to the label. */
  keywords?: string;
  /** Small leading glyph (flag, clock…). */
  icon?: React.ReactNode;
  /** Heading the option is listed under. Groups keep the order they first appear in. */
  group?: string;
};

/** Split options into consecutive headed groups, in first-seen order. */
function groupOptions(
  options: ComboboxOption[],
): { heading?: string; options: ComboboxOption[] }[] {
  const groups = new Map<string | undefined, ComboboxOption[]>();
  for (const o of options) {
    const list = groups.get(o.group);
    if (list) list.push(o);
    else groups.set(o.group, [o]);
  }
  return [...groups].map(([heading, options]) => ({ heading, options }));
}

function OptionRow({ option, checked }: { option: ComboboxOption; checked: boolean }) {
  return (
    <>
      <Check className={cn("mr-2 h-4 w-4 shrink-0", checked ? "opacity-100" : "opacity-0")} />
      {option.icon && <span className="mr-2 flex shrink-0 items-center">{option.icon}</span>}
      <span className="flex-1 truncate">{option.label}</span>
      {option.hint && <span className="text-xs text-muted-foreground">{option.hint}</span>}
    </>
  );
}

// forwardRef + prop spread so PopoverTrigger's asChild Slot can wire its click
// handler, ref and aria attributes onto the real button.
const TriggerButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<"button"> & { placeholder: string; filled: boolean }
>(({ children, placeholder, filled, className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    role="combobox"
    className={cn(
      "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
      className,
    )}
    {...props}
  >
    <span className={cn("flex min-w-0 items-center gap-1.5", !filled && "text-muted-foreground")}>
      {children ?? placeholder}
    </span>
    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
  </button>
));
TriggerButton.displayName = "TriggerButton";

/**
 * Generic searchable single-select built on Command + Popover, matching the
 * look of the application forms' city/country pickers. Set {@link allowCustom}
 * to let the user commit whatever they typed when nothing matches.
 */
export function Combobox({
  options,
  value,
  onSelect,
  onCustom,
  placeholder,
  searchPlaceholder,
  emptyText = "No results.",
  allowCustom = false,
  triggerIcon,
}: {
  options: ComboboxOption[];
  value: string;
  onSelect: (value: string, option?: ComboboxOption) => void;
  onCustom?: (value: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  allowCustom?: boolean;
  triggerIcon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const known = options.some((o) => o.value.toLowerCase() === trimmed.toLowerCase());

  const commitCustom = () => {
    if (!trimmed || !onCustom) return;
    onCustom(trimmed);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <TriggerButton placeholder={placeholder} filled={!!value}>
          {value ? (
            <>
              {triggerIcon}
              <span className="truncate">{value}</span>
            </>
          ) : (
            placeholder
          )}
        </TriggerButton>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput
            placeholder={searchPlaceholder ?? placeholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {allowCustom && trimmed ? (
                <button
                  type="button"
                  className="mx-auto block w-full px-2 py-1.5 text-sm hover:underline"
                  onClick={commitCustom}
                >
                  Use “{trimmed}”
                </button>
              ) : (
                emptyText
              )}
            </CommandEmpty>
            {groupOptions(options).map((g) => (
              <CommandGroup key={g.heading ?? ""} heading={g.heading}>
                {g.options.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={o.keywords ?? o.label}
                    onSelect={() => {
                      onSelect(o.value, o);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <OptionRow option={o} checked={value === o.value} />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            <CommandGroup>
              {allowCustom && trimmed && !known && (
                <CommandItem value={`use-custom-${trimmed}`} onSelect={commitCustom}>
                  <Check className="mr-2 h-4 w-4 opacity-0" />
                  Use “{trimmed}”
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Searchable multi-select: the list stays open while you tick options, and
 * the trigger sums up what's picked. Selection rules (e.g. an exclusive
 * "prefer not to say") belong to the caller's {@link onToggle}.
 */
export function MultiCombobox({
  options,
  values,
  onToggle,
  onClear,
  placeholder,
  searchPlaceholder,
  emptyText = "No results.",
  id,
}: {
  options: ComboboxOption[];
  values: string[];
  onToggle: (value: string) => void;
  onClear?: () => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const byValue = new Map(options.map((o) => [o.value, o]));
  const picked = values.map((v) => byValue.get(v)).filter((o) => o !== undefined);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <TriggerButton id={id} placeholder={placeholder} filled={picked.length > 0}>
          {picked.length ? (
            <>
              <span className="truncate">{picked.map((o) => o.label).join(", ")}</span>
              {picked.length > 1 && (
                <span className="shrink-0 rounded-full bg-muted px-1.5 text-xs font-medium tabular-nums text-muted-foreground">
                  {picked.length}
                </span>
              )}
            </>
          ) : (
            placeholder
          )}
        </TriggerButton>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder ?? placeholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {groupOptions(options).map((g) => (
              <CommandGroup key={g.heading ?? ""} heading={g.heading}>
                {g.options.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={o.keywords ?? o.label}
                    onSelect={() => onToggle(o.value)}
                  >
                    <OptionRow option={o} checked={values.includes(o.value)} />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
          {onClear && picked.length > 0 && (
            <div className="border-t p-1">
              <button
                type="button"
                onClick={onClear}
                className="w-full rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Clear selection
              </button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
