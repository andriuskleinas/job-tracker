import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * `/dashboard` was renamed to `/analytics`. Old bookmarks and any link still
 * pointing at the previous path land here and bounce straight through,
 * carrying their search params along — a saved link to a filtered view keeps
 * working rather than dropping the filter on the way.
 */
export const Route = createFileRoute("/_authenticated/dashboard")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/analytics", search });
  },
});
