import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Briefcase, CheckCircle2, ListChecks } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Job Tracker — Organize Your Job Search" },
      { name: "description", content: "Keep every application, interview, and follow-up in one simple dashboard." },
      { property: "og:title", content: "Job Tracker" },
      { property: "og:description", content: "Keep every application, interview, and follow-up in one simple dashboard." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <section className="text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Land your next role, organized.</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Track applications, interviews, and follow-up tasks in one clean, focused workspace.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Get started</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/applications">View dashboard</Link>
          </Button>
        </div>
      </section>
      <section className="mt-20 grid gap-6 sm:grid-cols-3">
        {[
          { icon: Briefcase, title: "Applications", body: "Log every role with status, date, and notes." },
          { icon: ListChecks, title: "Tasks", body: "Follow-ups tied to each application, with due dates." },
          { icon: CheckCircle2, title: "Private by default", body: "Row-level security keeps your data yours." },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-lg border bg-card p-6">
            <Icon className="h-6 w-6 text-primary" />
            <h3 className="mt-3 font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
