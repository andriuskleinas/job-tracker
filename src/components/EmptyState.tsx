import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

/**
 * The "nothing here yet" panel. One shape for every list in the portal, so an
 * empty dashboard and an empty task list read as the same product.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Card className="px-6 py-14 text-center sm:py-16">
      <p className="font-medium">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </Card>
  );
}
