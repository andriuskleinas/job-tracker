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
};

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
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.keywords ?? o.label}
                  onSelect={() => {
                    onSelect(o.value, o);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")}
                  />
                  {o.icon && <span className="mr-2">{o.icon}</span>}
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.hint && <span className="text-xs text-muted-foreground">{o.hint}</span>}
                </CommandItem>
              ))}
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
