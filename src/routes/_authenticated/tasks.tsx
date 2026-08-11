import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { RoleMultiSelect, type RoleOption } from "@/components/RoleMultiSelect";
import { statusColor, type Status } from "@/lib/status";
import { daysAgo, relativeDue } from "@/lib/relative-time";
import { faviconUrl, GENERIC_FAVICON_SIZE } from "@/lib/company-logo";
import { toast } from "sonner";
import { z } from "zod";
import { Plus, Pencil, Trash2, List, LayoutGrid } from "lucide-react";

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

const taskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  due_date: z.string().optional().or(z.literal("")),
  done: z.boolean(),
  roleIds: z.array(z.string()),
});

type TaskFormValues = z.infer<typeof taskSchema>;

type LinkedApplication = {
  id: string;
  company: string;
  position: string;
  status: Status;
  website: string | null;
};

type TaskRow = {
  id: string;
  title: string;
  due_date: string | null;
  done: boolean;
  task_applications: { application: LinkedApplication | null }[];
};

type View = "list" | "grid";

/**
 * Urgency buckets for open tasks. Time is the whole point of a follow-up — a
 * task due tomorrow and one due next month should never look the same — so the
 * list is grouped by how soon it's owed rather than shown as one flat pile.
 */
type Bucket = "overdue" | "today" | "week" | "later" | "nodate";

const BUCKET_ORDER: { key: Bucket; title: string; danger?: boolean }[] = [
  { key: "overdue", title: "Overdue", danger: true },
  { key: "today", title: "Today" },
  { key: "week", title: "This week" },
  { key: "later", title: "Later" },
  { key: "nodate", title: "No date" },
];

function dueBucket(due: string | null): Bucket {
  if (!due) return "nodate";
  const past = daysAgo(due); // positive = the due date is behind us
  if (past > 0) return "overdue";
  if (past === 0) return "today";
  return -past <= 7 ? "week" : "later";
}

/** Colour for the due label — red once overdue, amber for today/tomorrow. */
function dueClass(due: string): string {
  const past = daysAgo(due);
  if (past > 0) return "text-[var(--status-rejected-text)]";
  if (past >= -1) return "text-[var(--status-interviewing-text)]";
  return "text-muted-foreground";
}

/** Due date shown relative for open tasks ("2d overdue"), absolute once done. */
function DueLabel({ due, done }: { due: string; done: boolean }) {
  const absolute = new Date(due).toLocaleDateString();
  if (done) {
    return <span className="text-xs text-muted-foreground">Due {absolute}</span>;
  }
  return (
    <span className={`text-xs ${dueClass(due)}`} title={absolute}>
      {relativeDue(due)}
    </span>
  );
}

function TasksPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>(() => {
    if (typeof window === "undefined") return "list";
    return (localStorage.getItem("tasks-view") as View) || "list";
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);

  useEffect(() => {
    localStorage.setItem("tasks-view", view);
  }, [view]);

  const { data: roles = [] } = useQuery({
    queryKey: ["applications", "roleOptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("id, company, position")
        .order("company", { ascending: true });
      if (error) throw error;
      return data as RoleOption[];
    },
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(
          "*, task_applications(application:applications(id, company, position, status, website))",
        )
        .order("done")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as unknown as TaskRow[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["tasks"] });

  const create = useMutation({
    mutationFn: async (values: TaskFormValues) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const { data: task, error } = await supabase
        .from("tasks")
        .insert({
          user_id: userData.user.id,
          title: values.title,
          due_date: values.due_date || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (values.roleIds.length > 0) {
        const { error: linkError } = await supabase
          .from("task_applications")
          .insert(values.roleIds.map((application_id) => ({ task_id: task.id, application_id })));
        if (linkError) throw linkError;
      }
    },
    onSuccess: () => {
      toast.success("Task added");
      invalidate();
      setCreateOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add task"),
  });

  const update = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: TaskFormValues }) => {
      const { error } = await supabase
        .from("tasks")
        .update({
          title: values.title,
          due_date: values.due_date || null,
          done: values.done,
        })
        .eq("id", id);
      if (error) throw error;

      const { error: delError } = await supabase
        .from("task_applications")
        .delete()
        .eq("task_id", id);
      if (delError) throw delError;

      if (values.roleIds.length > 0) {
        const { error: linkError } = await supabase
          .from("task_applications")
          .insert(values.roleIds.map((application_id) => ({ task_id: id, application_id })));
        if (linkError) throw linkError;
      }
    },
    onSuccess: () => {
      toast.success("Task updated");
      invalidate();
      setEditingTask(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save task"),
  });

  const toggle = useMutation({
    mutationFn: async ({ tid, done }: { tid: string; done: boolean }) => {
      const { error } = await supabase.from("tasks").update({ done }).eq("id", tid);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (tid: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", tid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task deleted");
      invalidate();
    },
  });

  const completed = tasks.filter((t) => t.done);
  const openTasks = tasks.filter((t) => !t.done);
  const byBucket = openTasks.reduce<Record<Bucket, TaskRow[]>>(
    (acc, t) => {
      acc[dueBucket(t.due_date)].push(t);
      return acc;
    },
    { overdue: [], today: [], week: [], later: [], nodate: [] },
  );

  const renderSection = (title: string, items: TaskRow[], danger = false) => {
    if (items.length === 0) return null;
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2
            className={`text-sm font-medium ${danger ? "text-[var(--status-rejected-text)]" : "text-muted-foreground"}`}
          >
            {title}
          </h2>
          <span className="text-xs text-muted-foreground">{items.length}</span>
        </div>
        {view === "list" ? (
          <Card className="divide-y">
            {items.map((t) => (
              <TaskListRow
                key={t.id}
                task={t}
                onToggle={(done) => toggle.mutate({ tid: t.id, done })}
                onEdit={() => setEditingTask(t)}
                onDelete={() => remove.mutate(t.id)}
              />
            ))}
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((t) => (
              <TaskGridCard
                key={t.id}
                task={t}
                onToggle={(done) => toggle.mutate({ tid: t.id, done })}
                onEdit={() => setEditingTask(t)}
                onDelete={() => remove.mutate(t.id)}
              />
            ))}
          </div>
        )}
      </section>
    );
  };

  return (
    <main className="container-narrow page-body">
      <PageHeader
        title="Tasks"
        description="Every follow-up across your applications."
        actions={
          <>
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(v) => v && setView(v as View)}
              className="justify-start"
            >
              <ToggleGroupItem value="list" aria-label="List view" size="sm">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="grid" aria-label="Grid view" size="sm">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="h-4 w-4" /> New task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New task</DialogTitle>
                </DialogHeader>
                <TaskForm
                  roles={roles}
                  isPending={create.isPending}
                  onSubmit={(values) => create.mutate(values)}
                />
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <Dialog open={!!editingTask} onOpenChange={(v) => !v && setEditingTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
          </DialogHeader>
          {editingTask && (
            <TaskForm
              roles={roles}
              isPending={update.isPending}
              initialValues={{
                title: editingTask.title,
                due_date: editingTask.due_date ?? "",
                done: editingTask.done,
                roleIds: editingTask.task_applications
                  .map((ta) => ta.application?.id)
                  .filter((id): id is string => !!id),
              }}
              showDone
              onSubmit={(values) => update.mutate({ id: editingTask.id, values })}
            />
          )}
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : tasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          body="Add a follow-up yourself, or open an application and add one there — either way it'll show up here."
        />
      ) : (
        <div className="space-y-8">
          {BUCKET_ORDER.map(({ key, title, danger }) =>
            renderSection(title, byBucket[key], danger),
          )}
          {renderSection("Completed", completed)}
        </div>
      )}
    </main>
  );
}

/** Company logo for a role badge; falls back to the company name on a miss. */
function RoleLogo({ company, website }: { company: string; website: string | null }) {
  const [failed, setFailed] = useState(false);
  const url = faviconUrl(website);
  if (!url || failed) {
    return <span>{company}</span>;
  }
  return (
    <img
      src={url}
      alt={company}
      title={company}
      width={16}
      height={16}
      loading="lazy"
      className="h-4 w-4 shrink-0 rounded-sm object-contain"
      onError={() => setFailed(true)}
      onLoad={(e) => {
        // Domains with no real favicon return a 16px generic globe — treat only
        // that (not a smaller-but-real mark) as a miss and show the name.
        if (e.currentTarget.naturalWidth <= GENERIC_FAVICON_SIZE) setFailed(true);
      }}
    />
  );
}

function RoleBadges({ task }: { task: TaskRow }) {
  const applications = task.task_applications
    .map((ta) => ta.application)
    .filter((a): a is LinkedApplication => !!a);
  if (applications.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {applications.map((app) => (
        <Link key={app.id} to="/applications/$id" params={{ id: app.id }}>
          <Badge
            variant="outline"
            className={`${statusColor[app.status]} gap-1.5 font-normal transition-opacity hover:opacity-80`}
          >
            {app.position} · <RoleLogo company={app.company} website={app.website} />
          </Badge>
        </Link>
      ))}
    </div>
  );
}

function TaskListRow({
  task,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: TaskRow;
  onToggle: (done: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start gap-3 p-4">
      <Checkbox
        className="mt-0.5 shrink-0"
        checked={task.done}
        onCheckedChange={(v) => onToggle(!!v)}
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className={`text-sm ${task.done ? "text-muted-foreground line-through" : ""}`}>
          {task.title}
        </p>
        <RoleBadges task={task} />
        {task.due_date && <DueLabel due={task.due_date} done={task.done} />}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          aria-label={`Edit task: ${task.title}`}
          onClick={onEdit}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-brand-accent"
          aria-label={`Delete task: ${task.title}`}
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function TaskGridCard({
  task,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: TaskRow;
  onToggle: (done: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-2.5">
        <Checkbox
          className="mt-0.5 shrink-0"
          checked={task.done}
          onCheckedChange={(v) => onToggle(!!v)}
        />
        <p
          className={`min-w-0 flex-1 text-sm ${task.done ? "text-muted-foreground line-through" : ""}`}
        >
          {task.title}
        </p>
      </div>
      <RoleBadges task={task} />
      <div className="mt-auto flex items-center justify-between pt-1">
        {task.due_date ? <DueLabel due={task.due_date} done={task.done} /> : <span />}
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Edit task: ${task.title}`}
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-brand-accent"
            aria-label={`Delete task: ${task.title}`}
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function TaskForm({
  roles,
  initialValues,
  showDone = false,
  isPending,
  onSubmit,
}: {
  roles: RoleOption[];
  initialValues?: TaskFormValues;
  showDone?: boolean;
  isPending: boolean;
  onSubmit: (values: TaskFormValues) => void;
}) {
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [dueDate, setDueDate] = useState(initialValues?.due_date ?? "");
  const [done, setDone] = useState(initialValues?.done ?? false);
  const [roleIds, setRoleIds] = useState<string[]>(initialValues?.roleIds ?? []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = taskSchema.safeParse({ title, due_date: dueDate, done, roleIds });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    onSubmit(parsed.data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="task-title">Title</Label>
        <Input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Send follow-up email"
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="task-due-date">Due date</Label>
          <Input
            id="task-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        {showDone && (
          <div className="flex items-end pb-2.5">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={done} onCheckedChange={(v) => setDone(!!v)} />
              Completed
            </label>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <Label>Roles</Label>
        <RoleMultiSelect roles={roles} selected={roleIds} onChange={setRoleIds} />
        <p className="text-xs text-muted-foreground">
          Attach this task to any of the roles you're pursuing — the same task can cover more than
          one.
        </p>
      </div>
      <DialogFooter>
        <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
