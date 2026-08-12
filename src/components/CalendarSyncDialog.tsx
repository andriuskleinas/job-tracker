import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CalendarCheck } from "lucide-react";

type CalendarStatus = { connected: boolean; email: string | null };

/** The Google Calendar brand mark, used on the sync control and connect button. */
function GoogleCalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <rect width="22" height="22" x="13" y="13" fill="#fff" />
      <polygon
        fill="#1e88e5"
        points="25.68,20.92 26.688,22.36 28.272,21.208 28.272,29.56 30,29.56 30,18.616 28.56,18.616"
      />
      <path
        fill="#1e88e5"
        d="M22.943,23.745c0.625-0.574,1.013-1.37,1.013-2.249c0-1.747-1.533-3.168-3.417-3.168 c-1.602,0-2.972,1.009-3.33,2.453l1.657,0.421c0.166-0.669,0.834-1.146,1.673-1.146c0.942,0,1.709,0.607,1.709,1.44 c0,0.850-0.777,1.481-1.860,1.481h-0.474v1.64h0.474c1.135,0,1.960,0.664,1.960,1.578c0,0.921-0.856,1.622-1.990,1.622 c-1.019,0-1.911-0.653-2.078-1.519l-1.664,0.360c0.331,1.626,1.906,2.868,3.742,2.868c2.087,0,3.784-1.479,3.784-3.301 C24.842,25.316,24.093,24.281,22.943,23.745z"
      />
      <polygon fill="#fbc02d" points="34,42 14,42 13,38 14,34 34,34 35,38" />
      <polygon fill="#4caf50" points="38,35 42,34 42,14 38,13 34,14 34,34" />
      <path fill="#1e88e5" d="M34,14l1-4l-1-4H9C7.343,6,6,7.343,6,9v25l4,1l4-1V14H34z" />
      <polygon fill="#e53935" points="34,34 34,42 42,34" />
      <path fill="#1565c0" d="M39,6h-5v8h8V9C42,7.343,40.657,6,39,6z" />
      <path fill="#1565c0" d="M9,42h5v-8H6v5C6,40.657,7.343,42,9,42z" />
    </svg>
  );
}

/** fetch to a calendar endpoint with the current user's bearer token. */
async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  return fetch(path, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}` },
  });
}

/**
 * Connect the user's Google Calendar once; from then on every open, dated task is
 * pushed there automatically (see src/lib/calendar-sync.ts). Shows connection
 * state and lets them disconnect. One provider by design for this build.
 */
export function CalendarSyncDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ["calendar-status"],
    queryFn: async (): Promise<CalendarStatus> => {
      const res = await authedFetch("/calendar/google/status");
      if (!res.ok) throw new Error("Couldn't load calendar status");
      return (await res.json()) as CalendarStatus;
    },
    enabled: open,
    staleTime: 30_000,
    retry: false,
  });

  const connect = useMutation({
    mutationFn: async () => {
      const res = await authedFetch("/calendar/google/auth-url", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Couldn't start Google sign-in");
      }
      const { url } = (await res.json()) as { url: string };
      return url;
    },
    onSuccess: (url) => {
      window.location.href = url; // hand off to Google's consent screen
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't connect"),
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      const res = await authedFetch("/calendar/google/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("Couldn't disconnect");
    },
    onSuccess: () => {
      toast.success("Google Calendar disconnected");
      queryClient.invalidateQueries({ queryKey: ["calendar-status"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't disconnect"),
  });

  const connected = status?.connected;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Sync tasks to Google Calendar"
          title="Sync tasks to Google Calendar"
        >
          <GoogleCalendarIcon className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sync tasks to Google Calendar</DialogTitle>
          <DialogDescription>
            Connect once, and every task with a due date is added to your Google Calendar
            automatically — on your phone and computer. Completing or deleting a task removes its
            event. Tasks without a due date won't appear.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="py-4 text-sm text-muted-foreground">Checking your connection…</p>
        ) : connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-md border border-[var(--status-offer-soft)] bg-[var(--status-offer-soft)] px-3 py-2.5 text-sm">
              <CalendarCheck className="h-4 w-4 shrink-0 text-[var(--status-offer-text)]" />
              <span>
                Connected{status?.email ? " as " : ""}
                {status?.email && <span className="font-medium">{status.email}</span>}
              </span>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => disconnect.mutate()}
                disabled={disconnect.isPending}
              >
                {disconnect.isPending ? "Disconnecting…" : "Disconnect"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You'll be taken to Google to grant access, then brought right back.
            </p>
            <DialogFooter>
              <Button
                onClick={() => connect.mutate()}
                disabled={connect.isPending}
                className="gap-1.5"
              >
                <GoogleCalendarIcon className="h-4 w-4" />
                {connect.isPending ? "Redirecting…" : "Connect Google Calendar"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
