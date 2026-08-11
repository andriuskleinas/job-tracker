import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ApplicationCard, type ApplicationCardData } from "@/components/ApplicationCard";
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
import { LocationFields, type LocationValue } from "@/components/LocationFields";
import { ApplicationFilters } from "@/components/ApplicationFilters";
import { toast } from "sonner";
import { z } from "zod";
import { STATUSES } from "@/lib/status";
import { JOB_TYPES } from "@/lib/job-location";
import { Plus, Upload, Download, List, LayoutGrid } from "lucide-react";
import Papa from "papaparse";
import { useRef, useMemo } from "react";
import {
  EMPTY_FILTERS,
  filterApplications,
  hasActiveFilters,
  type ApplicationFilters as Filters,
} from "@/lib/application-filters";

type View = "list" | "grid";

// Filters live in the URL so a filtered board is shareable, survives refresh,
// and plays nicely with the back button. Everything is optional and coerced to
// a safe default, so a hand-edited or stale URL can never crash the page.
const searchSchema = z.object({
  q: z.string().catch("").optional(),
  status: z.array(z.enum(STATUSES)).catch([]).optional(),
  jobType: z.array(z.enum(JOB_TYPES)).catch([]).optional(),
  country: z.string().catch("").optional(),
  city: z.string().catch("").optional(),
});

type ApplicationsSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/_authenticated/applications/")({
  head: () => ({
    meta: [
      { title: "Applications — Job Tracker" },
      { name: "description", content: "Your tracked job applications." },
      { property: "og:title", content: "Applications — Job Tracker" },
      { property: "og:description", content: "Your tracked job applications." },
    ],
  }),
  validateSearch: (search): ApplicationsSearch => searchSchema.parse(search),
  component: ApplicationsPage,
});

const appBase = z.object({
  company: z.string().trim().min(1, "Company is required").max(120),
  position: z.string().trim().min(1, "Position is required").max(120),
  status: z.enum(STATUSES, { errorMap: () => ({ message: "Select application status" }) }),
  application_date: z.string().min(1, "Date is required"),
  website: z.string().trim().max(255).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  job_type: z.enum(JOB_TYPES).or(z.literal("")).optional(),
  country: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
});

// On-site and hybrid roles have a physical base, so both city and country are
// mandatory; fully remote roles leave them optional.
const requireLocation = (val: z.infer<typeof appBase>, ctx: z.RefinementCtx) => {
  if (val.job_type === "onsite" || val.job_type === "hybrid") {
    if (!val.city?.trim())
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["city"],
        message: "City is required for on-site and hybrid roles",
      });
    if (!val.country?.trim())
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["country"],
        message: "Country is required for on-site and hybrid roles",
      });
  }
};

const appSchema = appBase.superRefine(requireLocation);

// The New application dialog can also seed a first follow-up task, linked to the
// application that gets created. Both task fields are optional.
const appWithTaskSchema = appBase
  .extend({
    task_title: z.string().trim().max(200, "Task title must be 200 characters or fewer").optional(),
    task_due_date: z.string().optional(),
  })
  .superRefine(requireLocation);

function ApplicationsPage() {
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  // Normalise the loose URL search into the fully-populated filter shape the
  // toolbar and filter helper expect. Memoised so the derived list below only
  // recomputes when a filter actually changes.
  const filters: Filters = useMemo(
    () => ({
      q: search.q ?? "",
      status: search.status ?? [],
      jobType: search.jobType ?? [],
      country: search.country ?? "",
      city: search.city ?? "",
    }),
    [search.q, search.status, search.jobType, search.country, search.city],
  );
  const filtersActive = hasActiveFilters(filters);

  // Write filters back to the URL, dropping empties so the querystring stays
  // clean (?status=offer, not ?q=&country=&city=&status=offer).
  const patchFilters = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    navigate({
      search: {
        q: next.q.trim() || undefined,
        status: next.status.length ? next.status : undefined,
        jobType: next.jobType.length ? next.jobType : undefined,
        country: next.country || undefined,
        city: next.city || undefined,
      },
      replace: true,
    });
  };
  const clearFilters = () => navigate({ search: {}, replace: true });

  const [open, setOpen] = useState(false);
  const defaultLocation: LocationValue = { job_type: "onsite", country: "", city: "" };
  const [location, setLocation] = useState<LocationValue>(defaultLocation);
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
        .select("*, task_applications(task:tasks(id, due_date, done))")
        .order("application_date", { ascending: false });
      if (error) throw error;
      return data as unknown as ApplicationCardData[];
    },
  });

  const visibleApps = useMemo(() => filterApplications(apps, filters), [apps, filters]);

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
          website: values.website || null,
          notes: values.notes || null,
          job_type: values.job_type || null,
          country: values.country || null,
          city: values.city || null,
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
          website: r.website || null,
          notes: r.notes || null,
          job_type: r.job_type || null,
          country: r.country || null,
          city: r.city || null,
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
            website: (raw.website ?? "").trim(),
            notes: (raw.notes ?? "").trim(),
            job_type: (raw.job_type ?? "").trim().toLowerCase(),
            country: (raw.country ?? "").trim(),
            city: (raw.city ?? "").trim(),
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
      "company,position,status,application_date,website,notes\n" +
      "Acme Inc,Frontend Engineer,applied,2026-07-01,https://acme.com,Referred by Alice\n" +
      "Globex,Product Designer,interviewing,2026-07-15,globex.com,\n";
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
      website: fd.get("website"),
      notes: fd.get("notes"),
      job_type: location.job_type,
      country: location.country,
      city: location.city,
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
        count={isLoading ? undefined : filtersActive ? visibleApps.length : apps.length}
        description="Track progress towards your dream job."
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
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    disabled={importMut.isPending}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={importMut.isPending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" /> Choose CSV file
                  </Button>
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

            <Dialog
              open={open}
              onOpenChange={(v) => {
                setOpen(v);
                if (v) setLocation(defaultLocation);
              }}
            >
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
                    <Label htmlFor="website">Company website</Label>
                    <Input
                      id="website"
                      name="website"
                      type="url"
                      inputMode="url"
                      placeholder="acme.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      Used to show the company logo on the board.
                    </p>
                  </div>
                  <LocationFields value={location} onChange={setLocation} />
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
      ) : (
        <>
          <ApplicationFilters
            apps={apps}
            value={filters}
            onChange={patchFilters}
            onClear={clearFilters}
            resultCount={visibleApps.length}
          />
          {visibleApps.length === 0 ? (
            <EmptyState
              title="No matches"
              body="No applications match these filters. Try loosening or clearing them."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : view === "list" ? (
            <div className="grid gap-3">
              {visibleApps.map((a) => (
                <ApplicationCard key={a.id} app={a} variant="list" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleApps.map((a) => (
                <ApplicationCard key={a.id} app={a} variant="grid" />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
