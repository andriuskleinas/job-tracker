import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { z } from "zod";
import { STATUSES, statusColor, type Status } from "@/lib/status";
import { Plus, Upload, Download, List, LayoutGrid } from "lucide-react";
import Papa from "papaparse";
import { useRef } from "react";

type View = "list" | "grid";

export const Route = createFileRoute("/_authenticated/applications/")({
  head: () => ({
    meta: [
      { title: "Applications — Job Tracker" },
      { name: "description", content: "Your tracked job applications." },
      { property: "og:title", content: "Applications — Job Tracker" },
      { property: "og:description", content: "Your tracked job applications." },
    ],
  }),
  component: ApplicationsPage,
});

const appSchema = z.object({
  company: z.string().trim().min(1, "Company is required").max(120),
  position: z.string().trim().min(1, "Position is required").max(120),
  status: z.enum(STATUSES),
  application_date: z.string().min(1, "Date is required"),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

// The New application dialog can also seed a first follow-up task, linked to the
// application that gets created. Both task fields are optional.
const appWithTaskSchema = appSchema.extend({
  task_title: z.string().trim().max(200, "Task title must be 200 characters or fewer").optional(),
  task_due_date: z.string().optional(),
});

function ApplicationsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importErrors, setImportErrors] = useState<{ row: number; reason: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>(() => {
    if (typeof window === "undefined") return "list";
    return (localStorage.getItem("applications-view") as View) || "list";
  });

  useEffect(() => {
    localStorage.setItem("applications-view", view);
  }, [view]);

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("*")
        .order("application_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (values: z.infer<typeof appWithTaskSchema>) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const userId = userData.user.id;
      const { data: appRow, error } = await supabase
        .from("applications")
        .insert({
          user_id: userId,
          company: values.company,
          position: values.position,
          status: values.status,
          application_date: values.application_date,
          notes: values.notes || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      const taskTitle = values.task_title?.trim();
      if (taskTitle) {
        const { data: task, error: taskError } = await supabase
          .from("tasks")
          .insert({ user_id: userId, title: taskTitle, due_date: values.task_due_date || null })
          .select("id")
          .single();
        if (taskError) throw taskError;
        const { error: linkError } = await supabase
          .from("task_applications")
          .insert({ task_id: task.id, application_id: appRow.id });
        if (linkError) throw linkError;
      }
    },
    onSuccess: (_data, values) => {
      toast.success(values.task_title?.trim() ? "Application and task added" : "Application added");
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add"),
  });

  const importMut = useMutation({
    mutationFn: async (rows: z.infer<typeof appSchema>[]) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const userId = userData.user.id;
      const { error } = await supabase.from("applications").insert(
        rows.map((r) => ({
          user_id: userId,
          company: r.company,
          position: r.position,
          status: r.status,
          application_date: r.application_date,
          notes: r.notes || null,
        })),
      );
      if (error) throw error;
    },
    onSuccess: (_d, rows) => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast.success(`Imported ${rows.length} application${rows.length === 1 ? "" : "s"}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Import failed"),
  });

  const handleFile = (file: File) => {
    setImportErrors([]);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (results) => {
        const valid: z.infer<typeof appSchema>[] = [];
        const errs: { row: number; reason: string }[] = [];
        const today = new Date().toISOString().slice(0, 10);
        results.data.forEach((raw, i) => {
          const rowNum = i + 2; // header is row 1
          const parsed = appSchema.safeParse({
            company: (raw.company ?? "").trim(),
            position: (raw.position ?? "").trim(),
            status: (raw.status ?? "").trim().toLowerCase() || "applied",
            application_date: (raw.application_date ?? "").trim() || today,
            notes: (raw.notes ?? "").trim(),
          });
          if (parsed.success) valid.push(parsed.data);
          else
            errs.push({
              row: rowNum,
              reason: parsed.error.issues
                .map((x) => `${x.path.join(".")}: ${x.message}`)
                .join("; "),
            });
        });
        setImportErrors(errs);
        if (valid.length === 0) {
          toast.error("No valid rows to import");
          return;
        }
        importMut.mutate(valid, {
          onSuccess: () => {
            if (errs.length === 0) setImportOpen(false);
          },
        });
      },
      error: (err) => toast.error(`Parse failed: ${err.message}`),
    });
  };

  const downloadTemplate = () => {
    const csv =
      "company,position,status,application_date,notes\n" +
      "Acme Inc,Frontend Engineer,applied,2026-07-01,Referred by Alice\n" +
      "Globex,Product Designer,interviewing,2026-07-15,\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "applications-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = appWithTaskSchema.safeParse({
      company: fd.get("company"),
      position: fd.get("position"),
      status: fd.get("status"),
      application_date: fd.get("application_date"),
      notes: fd.get("notes"),
      task_title: fd.get("task_title"),
      task_due_date: fd.get("task_due_date"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    create.mutate(parsed.data);
  };

  return (
    <main className="container-page page-body">
      <PageHeader
        title="Applications"
        count={isLoading ? undefined : apps.length}
        description="Track every role you're pursuing."
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
            <Dialog
              open={importOpen}
              onOpenChange={(v) => {
                setImportOpen(v);
                if (!v) setImportErrors([]);
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  <Upload className="h-4 w-4" /> Import CSV
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import applications from CSV</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Columns: <code>company, position, status, application_date, notes</code>.
                    Missing status defaults to <code>applied</code>; missing date defaults to today.
                  </p>
                  <Button variant="ghost" size="sm" onClick={downloadTemplate} type="button">
                    <Download className="h-4 w-4" /> Download template
                  </Button>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    disabled={importMut.isPending}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                      e.target.value = "";
                    }}
                  />
                  {importMut.isPending && (
                    <p className="text-sm text-muted-foreground">Importing…</p>
                  )}
                  {importErrors.length > 0 && (
                    <div className="max-h-48 overflow-auto rounded-md border border-brand/40 bg-brand/5 p-3 text-xs">
                      <p className="mb-2 font-medium text-brand-accent">
                        Skipped {importErrors.length} row{importErrors.length === 1 ? "" : "s"}:
                      </p>
                      <ul className="space-y-1">
                        {importErrors.map((er) => (
                          <li key={er.row}>
                            <span className="font-mono">Row {er.row}:</span> {er.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="h-4 w-4" /> New application
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New application</DialogTitle>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="company">Company</Label>
                      <Input id="company" name="company" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="position">Position</Label>
                      <Input id="position" name="position" required />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select name="status" defaultValue="applied">
                        <SelectTrigger id="status">
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
                      <Label htmlFor="application_date">Application date</Label>
                      <Input
                        id="application_date"
                        name="application_date"
                        type="date"
                        defaultValue={new Date().toISOString().slice(0, 10)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea id="notes" name="notes" rows={3} />
                  </div>
                  <div className="space-y-3 rounded-lg border border-dashed p-4">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Add a follow-up task</p>
                      <p className="text-xs text-muted-foreground">
                        Optional — kick things off with the next thing you owe this application.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="task_title">Task (optional)</Label>
                      <Input
                        id="task_title"
                        name="task_title"
                        placeholder="e.g. Send follow-up email"
                        maxLength={200}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="task_due_date">Due date</Label>
                      <Input id="task_due_date" name="task_due_date" type="date" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" className="w-full sm:w-auto" disabled={create.isPending}>
                      {create.isPending ? "Saving…" : "Save"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : apps.length === 0 ? (
        <EmptyState
          title="No applications yet"
          body="Add your first one to start tracking where every role stands."
        />
      ) : view === "list" ? (
        <div className="grid gap-3">
          {apps.map((a) => (
            <Link key={a.id} to="/applications/$id" params={{ id: a.id }} className="block">
              <Card className="p-4 transition-colors hover:border-foreground/20 hover:bg-accent/40 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.position}</p>
                    <p className="truncate text-sm text-muted-foreground">{a.company}</p>
                  </div>
                  <Badge
                    className={statusColor[a.status as Status] + " shrink-0 capitalize"}
                    variant="outline"
                  >
                    {a.status}
                  </Badge>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Applied {new Date(a.application_date).toLocaleDateString()}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((a) => (
            <Link key={a.id} to="/applications/$id" params={{ id: a.id }} className="block h-full">
              <Card className="flex h-full flex-col gap-3 p-4 transition-colors hover:border-foreground/20 hover:bg-accent/40">
                <div className="flex items-start justify-between gap-3">
                  <Badge
                    className={statusColor[a.status as Status] + " shrink-0 capitalize"}
                    variant="outline"
                  >
                    {a.status}
                  </Badge>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.position}</p>
                  <p className="truncate text-sm text-muted-foreground">{a.company}</p>
                </div>
                <p className="mt-auto text-xs text-muted-foreground">
                  Applied {new Date(a.application_date).toLocaleDateString()}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
