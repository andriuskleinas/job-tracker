import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Push a task's current state to the user's connected calendar (Google), after a
 * create/update/delete. Best-effort by design: calendar sync must never block or
 * fail task CRUD, so this swallows errors into a quiet toast. A no-op server-side
 * when the user hasn't connected a calendar.
 *
 * Call it from a mutation's `onSuccess`. For deletes, call it with `deleted: true`
 * *before* removing the task row, so the mapping to the calendar event still exists.
 */
export async function syncTaskCalendar(
  taskId: string,
  opts: { deleted?: boolean } = {},
): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const res = await fetch("/calendar/google/sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ taskId, deleted: opts.deleted ?? false }),
    });
    if (!res.ok && res.status !== 401) {
      toast.warning("Task saved, but couldn't sync to your calendar.");
    }
  } catch {
    toast.warning("Task saved, but couldn't sync to your calendar.");
  }
}
