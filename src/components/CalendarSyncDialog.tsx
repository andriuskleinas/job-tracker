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
import { CalendarCheck, CalendarPlus } from "lucide-react";

type CalendarStatus = { connected: boolean; email: string | null };

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
        <Button variant="outline" size="sm" className="gap-1.5">
          <CalendarPlus className="h-4 w-4" />
          Calendar sync
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
                <CalendarPlus className="h-4 w-4" />
                {connect.isPending ? "Redirecting…" : "Connect Google Calendar"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
