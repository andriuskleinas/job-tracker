import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Upload, Download } from "lucide-react";
import Papa from "papaparse";
import { useRef } from "react";

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

const STATUSES = ["applied", "interviewing", "offer", "rejected", "withdrawn"] as const;
type Status = (typeof STATUSES)[number];

const statusColor: Record<Status, string> = {
  applied: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  interviewing: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  offer: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  rejected: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  withdrawn: "bg-muted text-muted-foreground",
};

const appSchema = z.object({
  company: z.string().trim().min(1, "Company is required").max(120),
  position: z.string().trim().min(1, "Position is required").max(120),
  status: z.enum(STATUSES),
  application_date: z.string().min(1, "Date is required"),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

function ApplicationsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importErrors, setImportErrors] = useState<{ row: number; reason: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    mutationFn: async (values: z.infer<typeof appSchema>) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const { error } = await supabase.from("applications").insert({
        user_id: userData.user.id,
        company: values.company,
        position: values.position,
        status: values.status,
        application_date: values.application_date,
        notes: values.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Application added");
      queryClient.invalidateQueries({ queryKey: ["applications"] });
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
          else errs.push({ row: rowNum, reason: parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") });
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
    const parsed = appSchema.safeParse({
      company: fd.get("company"),
      position: fd.get("position"),
      status: fd.get("status"),
      application_date: fd.get("application_date"),
      notes: fd.get("notes"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    create.mutate(parsed.data);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Applications</h1>
          <p className="text-sm text-muted-foreground">Track every role you're pursuing.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={importOpen} onOpenChange={(v) => { setImportOpen(v); if (!v) setImportErrors([]); }}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="mr-1 h-4 w-4" /> Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import applications from CSV</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Columns: <code>company, position, status, application_date, notes</code>. Missing status defaults to
                  <code> applied</code>; missing date defaults to today.
                </p>
                <Button variant="ghost" size="sm" onClick={downloadTemplate} type="button">
                  <Download className="mr-1 h-4 w-4" /> Download template
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
                {importMut.isPending && <p className="text-sm text-muted-foreground">Importing…</p>}
                {importErrors.length > 0 && (
                  <div className="max-h-48 overflow-auto rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
                    <p className="mb-2 font-medium text-destructive">
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
              <Button>
                <Plus className="mr-1 h-4 w-4" /> New application
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New application</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input id="company" name="company" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position">Position</Label>
                  <Input id="position" name="position" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
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
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : apps.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">No applications yet. Add your first one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {apps.map((a) => (
            <Link
              key={a.id}
              to="/applications/$id"
              params={{ id: a.id }}
              className="block"
            >
              <Card className="transition-colors hover:bg-accent/50">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-base">{a.position}</CardTitle>
                      <p className="text-sm text-muted-foreground">{a.company}</p>
                    </div>
                    <Badge className={statusColor[a.status as Status] + " capitalize"} variant="outline">
                      {a.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  Applied {new Date(a.application_date).toLocaleDateString()}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}