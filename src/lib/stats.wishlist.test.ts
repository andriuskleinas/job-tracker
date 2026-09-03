import { describe, expect, test } from "bun:test";
import {
  applicationTrend,
  computePeriodKpis,
  computeSnapshotKpis,
  conversionCohorts,
  eventsBeyondCurrentStatus,
  funnelStages,
  inDateRange,
  statusBreakdown,
  type StatsApplication,
  type StatsStatusEvent,
} from "@/lib/stats";

/*
 * `wishlist` is the first status that does not mean "an application was sent",
 * and every rate on the analytics page divides by applications sent. These
 * tests pin the boundary: a saved role is counted where statuses are
 * counted, and nowhere else.
 */

const TODAY = new Date(2026, 8, 2); // 2 Sep 2026, local

const dateAgo = (daysAgo: number) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - daysAgo);
  return d;
};

const day = (daysAgo: number) => dateAgo(daysAgo).toISOString().slice(0, 10);

const app = (
  id: string,
  status: StatsApplication["status"],
  daysAgo: number,
): StatsApplication => ({
  id,
  status,
  application_date: day(daysAgo),
});

const event = (
  id: string,
  status: StatsStatusEvent["status"],
  daysAgo: number,
): StatsStatusEvent => ({
  application_id: id,
  status,
  changed_at: day(daysAgo),
  created_at: day(daysAgo),
});

describe("wishlist rows are not applications", () => {
  const apps = [
    app("a", "applied", 3),
    app("b", "interviewing", 10),
    app("w1", "wishlist", 1),
    app("w2", "wishlist", 2),
  ];

  test("period KPIs count applications sent, and report saved separately", () => {
    const kpis = computePeriodKpis(apps, TODAY);
    expect(kpis.total).toBe(2);
    expect(kpis.saved).toBe(2);
  });

  test("a saved role does not count as recent activity", () => {
    // Both wishlist rows are 1-2 days old; only the applied one is in-window.
    const inWindow = apps.filter((a) => inDateRange(a.application_date, dateAgo(6), TODAY));
    expect(computePeriodKpis(inWindow, TODAY).total).toBe(1);
  });

  test("saving a role today does not reset the days-since-applied streak", () => {
    // The trap: clip a job on day 0 and the counter would read 0 days,
    // congratulating you for applying to nothing.
    expect(computeSnapshotKpis(apps, [], TODAY).daysSinceLastApplication).toBe(3);
  });

  test("the status breakdown is the one chart that still counts them", () => {
    const rows = statusBreakdown(apps);
    expect(rows.find((r) => r.status === "wishlist")?.count).toBe(2);
    expect(rows.reduce((n, r) => n + r.count, 0)).toBe(4);
  });

  test("the application trend ignores them", () => {
    const total = applicationTrend(apps, dateAgo(13), TODAY, "week").reduce(
      (n, b) => n + b.count,
      0,
    );
    expect(total).toBe(2);
  });

  test("conversion cohorts ignore them", () => {
    const total = conversionCohorts(apps, [], dateAgo(13), TODAY, "month").reduce(
      (n, c) => n + c.applied,
      0,
    );
    expect(total).toBe(2);
  });

  test("the funnel's top stage is 100% of applications, not of rows", () => {
    const funnel = funnelStages(apps, []);
    expect(funnel[0].count).toBe(2);
    expect(funnel[0].share).toBe(1);
    // 1 of the 2 sent applications reached interviewing.
    expect(funnel[1].count).toBe(1);
    expect(funnel[1].share).toBe(0.5);
  });
});

describe("a role applied to and then dragged back to the wishlist", () => {
  // The history is the honest record: this one really was applied to, so it
  // stays in the funnel even though its current status says otherwise.
  const apps = [app("a", "applied", 5), app("back", "wishlist", 20)];
  const events = [event("back", "applied", 20), event("back", "wishlist", 1)];

  test("still counts in the funnel, on the strength of its event log", () => {
    const funnel = funnelStages(apps, events);
    expect(funnel[0].count).toBe(2);
    expect(funnel[0].share).toBe(1);
  });

  test("is reported as history revealing more than current status shows", () => {
    expect(eventsBeyondCurrentStatus(apps, events)).toBe(1);
  });

  test("a wishlist row that was never applied to reveals nothing", () => {
    const never = [app("w", "wishlist", 4)];
    expect(eventsBeyondCurrentStatus(never, [event("w", "wishlist", 4)])).toBe(0);
  });
});
