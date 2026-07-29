import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/applications/$id")({
  head: () => ({
    meta: [
      { title: "Application — Job Tracker" },
      { name: "description", content: "Application detail and tasks." },
      { property: "og:title", content: "Application — Job Tracker" },
      { property: "og:description", content: "Application detail and tasks." },
    ],
  }),
  component: AppDetail,
});

const STATUSES = ["applied", "interviewing", "offer", "rejected", "withdrawn"] as const;

const editSchema = z.object({
  company: z.string().trim().min(1).max(120),
  position: z.string().trim().min(1).max(120),
  status: z.enum(STATUSES),
  application_date: z.string().min(1),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

function AppDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: app, isLoading } = useQuery({
    queryKey: ["applications", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("applications").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", "byApp", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("application_id", id)
        .order("done")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({
    company: "",
    position: "",
    status: "applied" as (typeof STATUSES)[number],
    application_date: "",
    notes: "",
  });

  useEffect(() => {
    if (app) {
      setForm({
        company: app.company,
        position: app.position,
        status: app.status,
        application_date: app.application_date,
        notes: app.notes ?? "",
      });
    }
  }, [app]);

  const update = useMutation({
    mutationFn: async (values: z.infer<typeof editSchema>) => {
      const { error } = await supabase
        .from("applications")
        .update({ ...values, notes: values.notes || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("applications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Application deleted");
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      navigate({ to: "/applications" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const addTask = useMutation({
    mutationFn: async (t: { title: string; due_date: string | null }) => {
      const { error } = await supabase.from("tasks").insert({
        application_id: id,
        title: t.title,
        due_date: t.due_date,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task added");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const toggleTask = useMutation({
    mutationFn: async ({ tid, done }: { tid: string; done: boolean }) => {
      const { error } = await supabase.from("tasks").update({ done }).eq("id", tid);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (tid: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", tid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task deleted");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  if (isLoading) return <main className="mx-auto max-w-4xl px-4 py-8 text-sm text-muted-foreground">Loading…</main>;
  if (!app)
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-sm text-muted-foreground">Application not found.</p>
        <Button asChild variant="link" className="px-0">
          <Link to="/applications">Back to applications</Link>
        </Button>
      </main>
    );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = editSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    update.mutate(parsed.data);
  };

  const onAddTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title") ?? "").trim();
    const due = String(fd.get("due_date") ?? "");
    if (!title || title.length > 200) {
      toast.error("Title required (max 200 chars)");
      return;
    }
    addTask.mutate({ title, due_date: due || null });
    e.currentTarget.reset();
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/applications">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Edit application</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as (typeof STATUSES)[number] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="application_date">Date</Label>
                <Input
                  id="application_date"
                  type="date"
                  value={form.application_date}
                  onChange={(e) => setForm({ ...form, application_date: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={4}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="flex justify-between">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive">
                    <Trash2 className="mr-1 h-4 w-4" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this application?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will also delete all associated tasks. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => del.mutate()}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={onAddTask} className="flex flex-wrap gap-2">
            <Input name="title" placeholder="e.g. Send follow-up email" className="min-w-[200px] flex-1" required />
            <Input name="due_date" type="date" className="w-40" />
            <Button type="submit" disabled={addTask.isPending}>
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </form>

          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks yet.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 p-3">
                  <Checkbox
                    checked={t.done}
                    onCheckedChange={(v) => toggleTask.mutate({ tid: t.id, done: !!v })}
                  />
                  <div className="flex-1">
                    <p className={`text-sm ${t.done ? "text-muted-foreground line-through" : ""}`}>{t.title}</p>
                    {t.due_date && (
                      <p className="text-xs text-muted-foreground">
                        Due {new Date(t.due_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteTask.mutate(t.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}