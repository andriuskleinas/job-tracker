import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
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
    <main className="container-narrow page-body">
      <PageHeader title="Tasks" description="Every follow-up across your applications." />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : tasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          body="Open an application and add a follow-up — it'll show up here with everything else that's due."
        />
      ) : (
        <Card className="divide-y">
          {tasks.map((t) => {
            const app = (
              t as unknown as {
                applications: { id: string; company: string; position: string } | null;
              }
            ).applications;
            return (
              <div key={t.id} className="flex items-start gap-3 p-4">
                <Checkbox
                  className="mt-0.5 shrink-0"
                  checked={t.done}
                  onCheckedChange={(v) => toggle.mutate({ tid: t.id, done: !!v })}
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${t.done ? "text-muted-foreground line-through" : ""}`}>
                    {t.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {app && (
                      <Link
                        to="/applications/$id"
                        params={{ id: app.id }}
                        className="truncate hover:text-foreground hover:underline"
                      >
                        {app.position} · {app.company}
                      </Link>
                    )}
                    {t.due_date && <span>Due {new Date(t.due_date).toLocaleDateString()}</span>}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="-mr-1 shrink-0 text-muted-foreground hover:text-brand-accent"
                  aria-label={`Delete task: ${t.title}`}
                  onClick={() => remove.mutate(t.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </Card>
      )}
    </main>
  );
}
