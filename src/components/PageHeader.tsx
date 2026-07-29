import type { ReactNode } from "react";

/**
 * The opening block of every app screen: title, one line of context, and an
 * optional action cluster. Actions stack full-width under the title on phones
 * and sit on the right from `sm` up.
 *
 * Type matches the marketing pages — same weight, same negative tracking — so
 * moving from the homepage into the portal doesn't feel like a different site.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">{actions}</div>
      )}
    </div>
  );
}
