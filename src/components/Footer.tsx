import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

/**
 * Site footer with the full sitemap. Shared by every public marketing page —
 * add new sections here, not per page.
 *
 * Every entry points at a route that exists today; homepage sections are
 * reached with a hash rather than a placeholder page.
 */
const sitemap = [
  {
    heading: "Product",
    links: [
      { label: "Overview", to: "/" },
      { label: "Capture", to: "/", hash: "features" },
      { label: "Follow-ups", to: "/", hash: "follow-ups" },
      { label: "Insights", to: "/", hash: "insights" },
    ],
  },
  {
    heading: "Workspace",
    links: [
      { label: "Dashboard", to: "/dashboard" },
      { label: "Applications", to: "/applications" },
      { label: "Tasks", to: "/tasks" },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Sign in", to: "/auth" },
      { label: "Create account", to: "/auth" },
      { label: "Reset password", to: "/reset-password" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container-page py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              One workspace for every application, interview and follow-up, so you always know what
              moves you closer to an offer.
            </p>
          </div>

          {sitemap.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
                {column.heading}
              </h2>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      hash={"hash" in link ? link.hash : undefined}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Job Tracker. All rights reserved.</p>
          <p className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
            Private by default — your data is yours alone.
          </p>
        </div>
      </div>
    </footer>
  );
}
