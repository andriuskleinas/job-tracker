import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";

function NotFoundComponent() {
  return (
    <div className="container-form flex min-h-[calc(100svh-4rem)] flex-col justify-center py-16">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-accent">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          Page not found
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
          <Link
            to="/"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
          <Link
            to="/applications"
            className="inline-flex h-10 items-center justify-center rounded-md border border-input px-5 text-sm font-medium transition-colors hover:bg-accent"
          >
            View applications
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="container-form flex min-h-[calc(100svh-4rem)] flex-col justify-center py-16">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-accent">Error</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
          This page didn't load
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Something went wrong on our end. You can try again or head back home.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "referrer", content: "strict-origin-when-cross-origin" },
      { httpEquiv: "X-Content-Type-Options", content: "nosniff" },
      { title: "Job Tracker — Organize Your Job Search" },
      {
        name: "description",
        content: "Track job applications and follow-up tasks in one clean dashboard.",
      },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Job Tracker" },
      {
        property: "og:description",
        content: "Track job applications and follow-up tasks in one clean dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      // Recovery links can land on any route (they fall back to the Site URL
      // root when the exact path isn't in Supabase's redirect allow-list), so
      // funnel the recovery session to the page that can set a new password.
      if (event === "PASSWORD_RECOVERY") {
        if (router.state.location.pathname !== "/reset-password") {
          router.navigate({ to: "/reset-password", replace: true });
        }
        return;
      }
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <Outlet />
      </div>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
