import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — Job Tracker" },
      { name: "description", content: "All follow-up tasks across your job applications." },
      { property: "og:title", content: "Tasks — Job Tracker" },
      { property: "og:description", content: "All follow-up tasks across your job applications." },
    ],
  }),
  component: TasksPage,
});

function TasksPage() {
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, applications:application_id (id, company, position)")
        .order("done")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ tid, done }: { tid: string; done: boolean }) => {
      const { error } = await supabase.from("tasks").update({ done }).eq("id", tid);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const remove = useMutation({
    mutationFn: async (tid: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", tid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task deleted");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
        <p className="text-sm text-muted-foreground">Every follow-up across your applications.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tasks yet. Open an application to add follow-ups.
            </p>
          ) : (
            <ul className="divide-y">
              {tasks.map((t) => {
                const app = (t as unknown as { applications: { id: string; company: string; position: string } | null }).applications;
                return (
                  <li key={t.id} className="flex items-center gap-3 py-3">
                    <Checkbox
                      checked={t.done}
                      onCheckedChange={(v) => toggle.mutate({ tid: t.id, done: !!v })}
                    />
                    <div className="flex-1">
                      <p className={`text-sm ${t.done ? "text-muted-foreground line-through" : ""}`}>
                        {t.title}
                      </p>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        {app && (
                          <Link
                            to="/applications/$id"
                            params={{ id: app.id }}
                            className="hover:underline"
                          >
                            {app.position} · {app.company}
                          </Link>
                        )}
                        {t.due_date && <span>Due {new Date(t.due_date).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(t.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}