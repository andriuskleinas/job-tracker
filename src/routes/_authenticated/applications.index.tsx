import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ApplicationCard, type ApplicationCardData } from "@/components/ApplicationCard";
import { ApplicationBoard } from "@/components/ApplicationBoard";
import { ApplicationArchive } from "@/components/ApplicationArchive";
import { RejectionReasonDialog } from "@/components/RejectionReasonDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NewApplicationDialog, type NewApplicationSubmit } from "@/components/NewApplicationDialog";
import { EMPTY_JOB_AD, jobAdColumns, jobAdSchema, type JobAdValue } from "@/lib/job-ad-form";
import { applicationSchema } from "@/lib/application-form";
import { ApplicationFilters } from "@/components/ApplicationFilters";
import { CalendarSyncDialog } from "@/components/CalendarSyncDialog";
import { TaskForm, type TaskFormValues } from "@/components/TaskForm";
import { TaskSummaryPanel, countOverdue, useAllTasks } from "@/components/TaskSummaryPanel";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { DailyGoalTracker } from "@/components/DailyGoalTracker";
import { DEFAULT_DAILY_GOAL, fetchProfile, type AccountProfile } from "@/lib/profile";
import type { RoleOption } from "@/components/RoleMultiSelect";
import { toast } from "sonner";
import { z } from "zod";
import { STATUSES, CLOSED_STATUSES, type Status } from "@/lib/status";
import { syncTaskCalendar } from "@/lib/calendar-sync";
import {
  EMPTY_REJECTION,
  rejectionColumns,
  rejectionFromRow,
  type RejectionReason,
} from "@/lib/rejection";
import { JOB_TYPES } from "@/lib/job-location";
import { Plus, Upload, Download, List, LayoutGrid, Columns3, ListChecks } from "lucide-react";
import Papa from "papaparse";
import { useRef, useMemo } from "react";
import {
  EMPTY_FILTERS,
  filterApplications,
  hasActiveFilters,
  type ApplicationFilters as Filters,
} from "@/lib/application-filters";

type View = "list" | "grid" | "board";

const VIEW_KEY = "applications-view";
const TASKS_PANEL_KEY = "applications-tasks-panel";

/** The stored preference, validated so a stale or hand-edited value can never reach the renderer. */
function storedView(): View {
  if (typeof window === "undefined") return "list";
  const raw = localStorage.getItem(VIEW_KEY);
  return raw === "grid" || raw === "board" ? raw : "list";
}

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
      {
        name: "description",
        content: "Every role you're going after, and where each one stands.",
      },
      { property: "og:title", content: "Applications — Job Tracker" },
      {
        property: "og:description",
        content: "Every role you're going after, and where each one stands.",
      },
    ],
  }),
  validateSearch: (search): ApplicationsSearch => searchSchema.parse(search),
  component: ApplicationsPage,
});

/** One CSV row: the application itself plus its job-ad block. */
type ImportRow = { app: z.infer<typeof applicationSchema>; ad: JobAdValue };

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
  const [importOpen, setImportOpen] = useState(false);
  const [importErrors, setImportErrors] = useState<{ row: number; reason: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>(storedView);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  // The task panel sits beside the applications on wide screens (xl+), open by
  // default and remembered when closed. Narrower screens have no room for a
  // second column, so the same panel slides over as a sheet instead.
  const [tasksPanelOpen, setTasksPanelOpen] = useState(
    () => typeof window === "undefined" || localStorage.getItem(TASKS_PANEL_KEY) !== "closed",
  );
  const [tasksSheetOpen, setTasksSheetOpen] = useState(false);
  // An application on its way to `rejected`, waiting on the reason prompt.
  // `commit` is what Save (with a reason) or Skip (null) goes ahead and does;
  // closing the prompt drops it, which cancels a move.
  const [pendingRejection, setPendingRejection] = useState<{
    subject: string;
    initial: RejectionReason;
    commit: (reason: RejectionReason | null) => void;
    /** False when only editing a reason — there is no move to skip ahead to. */
    skippable: boolean;
  } | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  useEffect(() => {
    localStorage.setItem(TASKS_PANEL_KEY, tasksPanelOpen ? "open" : "closed");
  }, [tasksPanelOpen]);

  const { data: allTasks = [], isLoading: tasksLoading } = useAllTasks();
  const overdueTasks = useMemo(() => countOverdue(allTasks), [allTasks]);

  // The daily goal lives on the profile so it follows the user across
  // devices. Same `["profile"]` cache entry as the navbar and account page.
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: fetchProfile });
  const dailyGoal = profile?.daily_application_goal ?? DEFAULT_DAILY_GOAL;
  const saveDailyGoal = useMutation({
    mutationFn: async (goal: number) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      // Upsert, not update: a profile row isn't guaranteed to exist yet.
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: userData.user.id, daily_application_goal: goal });
      if (error) throw error;
    },
    onMutate: async (goal) => {
      await queryClient.cancelQueries({ queryKey: ["profile"] });
      const previous = queryClient.getQueryData<AccountProfile | null>(["profile"]);
      if (previous) {
        queryClient.setQueryData<AccountProfile>(["profile"], {
          ...previous,
          daily_application_goal: goal,
        });
      }
      return { previous };
    },
    onError: (e, _goal, context) => {
      if (context?.previous) queryClient.setQueryData(["profile"], context.previous);
      toast.error(e instanceof Error ? e.message : "Failed to save goal");
    },
    onSuccess: () => toast.success("Daily goal updated"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
  });

  const openNewTask = () => {
    setTasksSheetOpen(false);
    setCreateTaskOpen(true);
  };

  // Google Calendar OAuth bounces back to /applications?calendar=connected|error.
  // Surface the outcome, refresh the connection state, and strip the param from
  // the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("calendar");
    if (!result) return;
    if (result === "connected") {
      toast.success("Google Calendar connected — your dated tasks will sync automatically.");
      queryClient.invalidateQueries({ queryKey: ["calendar-status"] });
    } else if (result === "error") {
      toast.error("Couldn't connect Google Calendar. Please try again.");
    }
    params.delete("calendar");
    const qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, [queryClient]);

  // A board on a phone is a horizontal scroller wrapping vertical scrollers,
  // which is the worst of both. The list is the honest small-screen answer, so
  // narrow viewports fall back to it whenever the board is selected, and the
  // toggle goes away rather than offering a choice that would make the page
  // worse. Grid is unaffected — its columns already collapse to one on a
  // narrow screen, which is just the list with cards instead of rows. The
  // stored preference is untouched, so the board comes back on the desktop it
  // was chosen on.
  const effectiveView: View = view === "board" && isMobile ? "list" : view;

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("*, task_applications(task:tasks(id, due_date, done, priority))")
        .order("application_date", { ascending: false });
      if (error) throw error;
      return data as unknown as ApplicationCardData[];
    },
  });

  // Starred opportunities pin to the top; the query's application_date-desc
  // order is preserved among apps of equal priority (stable sort).
  const visibleApps = useMemo(
    () => filterApplications(apps, filters).sort((a, b) => Number(b.priority) - Number(a.priority)),
    [apps, filters],
  );

  // Rejected and withdrawn applications live in the archive at the bottom of
  // the page, not in whichever of list/grid/board is on screen — a person
  // looking at their pipeline is not looking for the roles they are no
  // longer pursuing. Split once here so every view downstream renders only
  // the live half; both halves still respect whatever filters are active.
  const liveApps = useMemo(
    () => visibleApps.filter((a) => !CLOSED_STATUSES.includes(a.status)),
    [visibleApps],
  );
  const archivedApps = useMemo(
    () => visibleApps.filter((a) => CLOSED_STATUSES.includes(a.status)),
    [visibleApps],
  );

  // The role picker in the "New task" dialog — every application already
  // loaded for this page, so no second query just to list them.
  const roles: RoleOption[] = useMemo(
    () =>
      apps
        .map((a) => ({ id: a.id, company: a.company, position: a.position }))
        .sort((a, b) => a.company.localeCompare(b.company)),
    [apps],
  );

  const create = useMutation({
    mutationFn: async ({ jobAd, ...values }: NewApplicationSubmit) => {
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
          ...jobAdColumns(jobAd),
        })
        .select("id")
        .single();
      if (error) throw error;

      const taskTitle = values.task_title?.trim();
      let taskId: string | null = null;
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
        taskId = task.id as string;
      }
      return { appId: appRow.id as string, taskId };
    },
    onSuccess: ({ appId, taskId }, values) => {
      toast.success(values.task_title?.trim() ? "Application and task added" : "Application added");
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setOpen(false);
      if (taskId) void syncTaskCalendar(taskId);
      // Logged straight in as rejected — the row already exists, so the
      // prompt only adds the reason to it; skipping or closing leaves it be.
      if (values.status === "rejected") {
        setPendingRejection({
          subject: `${values.position} at ${values.company}`,
          initial: EMPTY_REJECTION,
          commit: (reason) => reason && saveRejection.mutate({ aid: appId, reason }),
          skippable: true,
        });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add"),
  });

  // The "New task" dialog in the toolbar — a follow-up not tied to the moment
  // of adding a role, e.g. a reminder set days later against one or more
  // applications already on the board.
  const createTask = useMutation({
    mutationFn: async (values: TaskFormValues) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const { data: task, error } = await supabase
        .from("tasks")
        .insert({
          user_id: userData.user.id,
          title: values.title,
          due_date: values.due_date || null,
          due_time: values.due_date && values.due_time ? values.due_time : null,
          duration_minutes: values.due_date && values.due_time ? values.duration : null,
          priority: values.priority,
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
      return task.id as string;
    },
    onSuccess: (taskId) => {
      toast.success("Task added");
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setCreateTaskOpen(false);
      void syncTaskCalendar(taskId);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add task"),
  });

  const importMut = useMutation({
    mutationFn: async (rows: ImportRow[]) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const userId = userData.user.id;
      const { error } = await supabase.from("applications").insert(
        rows.map(({ app: r, ad }) => ({
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
          ...jobAdColumns(ad),
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

  const togglePriority = useMutation({
    mutationFn: async ({ aid, priority }: { aid: string; priority: boolean }) => {
      const { error } = await supabase.from("applications").update({ priority }).eq("id", aid);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["applications"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update priority"),
  });

  // The card menu's "Delete" — every card view (list, grid, board, archive)
  // reaches the same mutation, so a role deleted from the board disappears
  // everywhere else too, not just wherever it was clicked.
  const deleteApp = useMutation({
    mutationFn: async (aid: string) => {
      const { error } = await supabase.from("applications").delete().eq("id", aid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Application deleted");
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const saveRejection = useMutation({
    mutationFn: async ({ aid, reason }: { aid: string; reason: RejectionReason }) => {
      const { error } = await supabase
        .from("applications")
        .update(rejectionColumns(reason))
        .eq("id", aid);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["applications"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save reason"),
  });

  /**
   * Move an application to another status — the board's whole reason to exist,
   * and also what the card's "Move to" menu calls.
   *
   * Optimistic, because the card has to land under the cursor at the moment it
   * is dropped; a round trip first would show it snap back to the old column
   * and then jump. The snapshot is restored verbatim if the write fails.
   */
  const moveStatus = useMutation({
    mutationFn: async ({
      app,
      status,
      reason,
    }: {
      app: ApplicationCardData;
      status: Status;
      /** Only when moving to `rejected` and the prompt was answered. */
      reason?: RejectionReason;
    }) => {
      // Leaving the wishlist is the moment an application is actually sent, so
      // that is when application_date becomes true. It was the row's creation
      // date until now — a placeholder the NOT NULL column demanded — and
      // leaving it would date every application to the day the job was
      // bookmarked, quietly ageing it in the "Stalled" check and filing it in
      // the wrong week of the volume chart.
      const becameAnApplication = app.status === "wishlist" && status !== "wishlist";
      const { error } = await supabase
        .from("applications")
        .update({
          status,
          ...(becameAnApplication
            ? { application_date: new Date().toISOString().slice(0, 10) }
            : {}),
          ...(reason ? rejectionColumns(reason) : {}),
        })
        .eq("id", app.id);
      if (error) throw error;
    },
    onMutate: async ({ app, status, reason }) => {
      await queryClient.cancelQueries({ queryKey: ["applications"] });
      const previous = queryClient.getQueryData<ApplicationCardData[]>(["applications"]);
      queryClient.setQueryData<ApplicationCardData[]>(["applications"], (old) =>
        (old ?? []).map((a) =>
          a.id === app.id ? { ...a, status, ...(reason ? rejectionColumns(reason) : {}) } : a,
        ),
      );
      return { previous };
    },
    onError: (e, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["applications"], context.previous);
      toast.error(e instanceof Error ? e.message : "Failed to move application");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["applications"] }),
  });

  // Every status change on this page goes through here, so `rejected` is
  // always asked about — whichever card, menu or drag it came from. A
  // previous reason (the card was rejected once, then reopened) pre-fills it.
  const requestMove = (app: ApplicationCardData, status: Status) => {
    if (status !== "rejected") {
      moveStatus.mutate({ app, status });
      return;
    }
    setPendingRejection({
      subject: `${app.position} at ${app.company}`,
      initial: rejectionFromRow(app),
      commit: (reason) => moveStatus.mutate({ app, status, reason: reason ?? undefined }),
      skippable: true,
    });
  };

  const editRejection = (app: ApplicationCardData) =>
    setPendingRejection({
      subject: `${app.position} at ${app.company}`,
      initial: rejectionFromRow(app),
      commit: (reason) => reason && saveRejection.mutate({ aid: app.id, reason }),
      skippable: false,
    });

  const handleFile = (file: File) => {
    setImportErrors([]);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (results) => {
        const valid: ImportRow[] = [];
        const errs: { row: number; reason: string }[] = [];
        const today = new Date().toISOString().slice(0, 10);
        results.data.forEach((raw, i) => {
          const rowNum = i + 2; // header is row 1
          const parsed = applicationSchema.safeParse({
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
          const ad = jobAdSchema.safeParse({
            ...EMPTY_JOB_AD,
            job_url: (raw.job_url ?? "").trim(),
            description: (raw.description ?? "").trim(),
            requirements: (raw.requirements ?? "").trim(),
            salary_min: (raw.salary_min ?? "").trim(),
            salary_max: (raw.salary_max ?? "").trim(),
            salary_currency: (raw.salary_currency ?? "").trim().toUpperCase(),
            salary_period: (raw.salary_period ?? "").trim().toLowerCase(),
            salary_source: (raw.salary_source ?? "").trim().toLowerCase(),
          });
          if (parsed.success && ad.success) {
            valid.push({ app: parsed.data, ad: ad.data as JobAdValue });
          } else {
            const issues = [
              ...(parsed.success ? [] : parsed.error.issues),
              ...(ad.success ? [] : ad.error.issues),
            ];
            errs.push({
              row: rowNum,
              reason: issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; "),
            });
          }
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
      "company,position,status,application_date,website,notes," +
      "job_url,salary_min,salary_max,salary_currency,salary_period,salary_source,requirements,description\n" +
      "Acme Inc,Frontend Engineer,applied,2026-07-01,https://acme.com,Referred by Alice," +
      "https://boards.greenhouse.io/acme/jobs/1,65000,80000,EUR,year,posted,5+ years with React,Full ad text\n" +
      "Globex,Product Designer,interviewing,2026-07-15,globex.com,,,,,,,,\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "applications-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    // data-wide lets the navbar widen with the page (see styles.css), so its
    // right edge stays in line with the toolbar below it.
    <main
      data-wide={tasksPanelOpen || undefined}
      className={`container-page page-body ${tasksPanelOpen ? "xl:max-w-[92rem]" : ""}`}
    >
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
              className={`justify-start ${isMobile ? "hidden" : ""}`}
            >
              <ToggleGroupItem value="list" aria-label="List view" size="sm">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="grid" aria-label="Grid view" size="sm">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="board" aria-label="Board view" size="sm">
                <Columns3 className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>

            <div className="flex items-center gap-2">
              <span className="hidden text-sm text-muted-foreground sm:inline">Sync Calendar:</span>
              <CalendarSyncDialog />
            </div>

            {/* One button, two behaviours: below xl it opens the sheet, at xl
                it shows or hides the column beside the board. */}
            <Button
              variant="outline"
              className="w-full sm:w-auto xl:hidden"
              onClick={() => setTasksSheetOpen(true)}
            >
              <ListChecks className="h-4 w-4" /> Tasks
              {overdueTasks > 0 && <OverdueBadge count={overdueTasks} />}
            </Button>
            <Button
              variant="outline"
              className="hidden xl:inline-flex"
              aria-pressed={tasksPanelOpen}
              onClick={() => setTasksPanelOpen((v) => !v)}
            >
              <ListChecks className="h-4 w-4" /> {tasksPanelOpen ? "Hide tasks" : "Tasks"}
              {!tasksPanelOpen && overdueTasks > 0 && <OverdueBadge count={overdueTasks} />}
            </Button>

            <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New task</DialogTitle>
                </DialogHeader>
                <TaskForm
                  roles={roles}
                  isPending={createTask.isPending}
                  onSubmit={(values) => createTask.mutate(values)}
                />
              </DialogContent>
            </Dialog>

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
                    Columns: <code>company, position, status, application_date, notes</code>, plus
                    optional{" "}
                    <code>
                      job_url, salary_min, salary_max, salary_currency, salary_period,
                      salary_source, requirements, description
                    </code>
                    . Missing status defaults to <code>applied</code>; missing date defaults to
                    today. A salary needs a currency with it.
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

            <NewApplicationDialog
              open={open}
              onOpenChange={setOpen}
              isPending={create.isPending}
              onSubmit={(values) => create.mutateAsync(values)}
              trigger={
                <Button className="w-full sm:w-auto">
                  <Plus className="h-4 w-4" /> New application
                </Button>
              }
            />
          </>
        }
      />

      <div
        className={
          tasksPanelOpen ? "xl:grid xl:grid-cols-[minmax(0,1fr)_19rem] xl:items-start xl:gap-8" : ""
        }
      >
        <div className="min-w-0">
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
              {liveApps.length === 0 ? (
                archivedApps.length > 0 ? (
                  // Not "no matches" — there are matches, they're just all closed.
                  // Sending someone to "widen or clear filters" when the fix is
                  // "scroll down" would be actively wrong advice.
                  <EmptyState
                    title="Nothing in your active pipeline"
                    body="Every application that matches is closed — see it in the archive below."
                  />
                ) : (
                  <EmptyState
                    title="No matches"
                    body="No applications match these filters. Widen or clear them to see more."
                    action={
                      <Button variant="outline" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    }
                  />
                )
              ) : effectiveView === "list" ? (
                <div className="grid gap-3">
                  {liveApps.map((a) => (
                    <ApplicationCard
                      key={a.id}
                      app={a}
                      variant="list"
                      onTogglePriority={(priority) =>
                        togglePriority.mutate({ aid: a.id, priority })
                      }
                      onDelete={() => deleteApp.mutate(a.id)}
                    />
                  ))}
                </div>
              ) : effectiveView === "grid" ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {liveApps.map((a) => (
                    <ApplicationCard
                      key={a.id}
                      app={a}
                      variant="grid"
                      onTogglePriority={(priority) =>
                        togglePriority.mutate({ aid: a.id, priority })
                      }
                      onDelete={() => deleteApp.mutate(a.id)}
                    />
                  ))}
                </div>
              ) : (
                <ApplicationBoard
                  apps={liveApps}
                  onTogglePriority={(a, priority) => togglePriority.mutate({ aid: a.id, priority })}
                  onMoveTo={requestMove}
                  onDelete={(a) => deleteApp.mutate(a.id)}
                />
              )}
              {/* Same across all three views above — rejected and withdrawn have
              exactly one home on this page, and it isn't inline with the
              applications still moving. */}
              <ApplicationArchive
                apps={archivedApps}
                onTogglePriority={(a, priority) => togglePriority.mutate({ aid: a.id, priority })}
                onDelete={(a) => deleteApp.mutate(a.id)}
                onEditRejection={editRejection}
              />
            </>
          )}
        </div>
        {tasksPanelOpen && (
          <aside className="sticky top-20 hidden max-h-[calc(100vh-6rem)] flex-col gap-4 overflow-y-auto xl:flex">
            <div className="rounded-xl border bg-muted p-5">
              <TaskSummaryPanel tasks={allTasks} isLoading={tasksLoading} onNewTask={openNewTask} />
            </div>
            <div className="rounded-xl border bg-muted p-5">
              <DailyGoalTracker
                apps={apps}
                goal={dailyGoal}
                onGoalChange={(goal) => saveDailyGoal.mutate(goal)}
              />
            </div>
          </aside>
        )}
      </div>
      <Sheet open={tasksSheetOpen} onOpenChange={setTasksSheetOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
          <SheetTitle className="sr-only">Tasks</SheetTitle>
          <SheetDescription className="sr-only">
            Every task across your applications, grouped by when it is due, and your daily
            application goal.
          </SheetDescription>
          <div className="space-y-8 pt-6">
            <TaskSummaryPanel tasks={allTasks} isLoading={tasksLoading} onNewTask={openNewTask} />
            <div className="border-t pt-6">
              <DailyGoalTracker
                apps={apps}
                goal={dailyGoal}
                onGoalChange={(goal) => saveDailyGoal.mutate(goal)}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <RejectionReasonDialog
        open={pendingRejection !== null}
        onOpenChange={(v) => !v && setPendingRejection(null)}
        subject={pendingRejection?.subject}
        initial={pendingRejection?.initial}
        onSave={(reason) => {
          pendingRejection?.commit(reason);
          setPendingRejection(null);
        }}
        onSkip={
          pendingRejection?.skippable
            ? () => {
                pendingRejection.commit(null);
                setPendingRejection(null);
              }
            : undefined
        }
      />
    </main>
  );
}

function OverdueBadge({ count }: { count: number }) {
  return (
    <span
      className="ml-0.5 rounded-full bg-[var(--status-rejected-soft)] px-1.5 text-xs font-medium text-brand-accent"
      aria-label={`${count} overdue`}
    >
      {count}
    </span>
  );
}
