import { Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Wordmark: a solid black tile with the one red mark in the system sitting on
 * its corner. Used in the header, the footer and the auth screens.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg bg-foreground">
        <Briefcase className="h-4 w-4 text-background" aria-hidden="true" />
        <span
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-background"
          aria-hidden="true"
        />
      </span>
      <span className="text-[0.95rem] font-semibold tracking-tight">Job Tracker</span>
    </span>
  );
}
