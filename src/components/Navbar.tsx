import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/Logo";
import { Menu } from "lucide-react";

/** Single source of truth for the portal nav — desktop bar and mobile sheet. */
const appLinks = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Applications", to: "/applications" },
  { label: "Tasks", to: "/tasks" },
] as const;

const linkBase =
  "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
const linkActive = "rounded-md px-3 py-1.5 text-sm bg-accent font-medium text-foreground";

export function Navbar() {
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      setEmail(data.session?.user.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session);
      setEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link to="/" aria-label="Job Tracker home">
          <Logo />
        </Link>

        {/* Desktop */}
        <nav className="hidden items-center gap-1 md:flex">
          {signedIn ? (
            <>
              {appLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={linkBase}
                  activeProps={{ className: linkActive }}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                to="/account"
                className="ml-2 max-w-[16ch] truncate text-xs text-muted-foreground transition-colors hover:text-foreground lg:max-w-none"
                activeProps={{
                  className: "ml-2 max-w-[16ch] truncate text-xs text-foreground lg:max-w-none",
                }}
                title="Account settings"
              >
                {email}
              </Link>
              <Button variant="ghost" size="sm" className="ml-1" onClick={handleSignOut}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Link to="/" hash="features" className={linkBase}>
                Features
              </Link>
              <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/auth" })}>
                Sign in
              </Button>
              <Button size="sm" className="ml-1" onClick={() => navigate({ to: "/auth" })}>
                Get started
              </Button>
            </>
          )}
        </nav>

        {/* Mobile */}
        <div className="flex items-center gap-2 md:hidden">
          {!signedIn && (
            <Button size="sm" onClick={() => navigate({ to: "/auth" })}>
              Get started
            </Button>
          )}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[17rem] p-0">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="flex h-full flex-col">
                <div className="border-b px-5 py-4">
                  <Logo />
                  {signedIn && email && (
                    <p className="mt-3 truncate text-xs text-muted-foreground">{email}</p>
                  )}
                </div>

                <nav className="flex flex-1 flex-col gap-1 p-3">
                  {(signedIn ? appLinks : ([{ label: "Home", to: "/" }] as const)).map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setMenuOpen(false)}
                      className="rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      activeProps={{
                        className:
                          "rounded-md px-3 py-2.5 text-sm bg-accent font-medium text-foreground",
                      }}
                    >
                      {link.label}
                    </Link>
                  ))}
                  {signedIn && (
                    <Link
                      to="/account"
                      onClick={() => setMenuOpen(false)}
                      className="rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      activeProps={{
                        className:
                          "rounded-md px-3 py-2.5 text-sm bg-accent font-medium text-foreground",
                      }}
                    >
                      Account
                    </Link>
                  )}
                  {!signedIn && (
                    <Link
                      to="/"
                      hash="features"
                      onClick={() => setMenuOpen(false)}
                      className="rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      Features
                    </Link>
                  )}
                </nav>

                <div className="border-t p-3">
                  {signedIn ? (
                    <Button variant="outline" className="w-full" onClick={handleSignOut}>
                      Sign out
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => {
                        setMenuOpen(false);
                        navigate({ to: "/auth" });
                      }}
                    >
                      Sign in
                    </Button>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
