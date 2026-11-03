import { describe, expect, test } from "bun:test";
import { applicationsPerDay, bestStreak, currentStreak, lastDays } from "./daily-goal";

const app = (application_date: string, status = "applied") => ({ status, application_date });

describe("applicationsPerDay", () => {
  test("counts sent applications per date and skips the wishlist", () => {
    const counts = applicationsPerDay([
      app("2026-11-01"),
      app("2026-11-01", "rejected"),
      app("2026-11-01", "wishlist"),
      app("2026-11-02", "interviewing"),
    ]);
    expect(counts.get("2026-11-01")).toBe(2);
    expect(counts.get("2026-11-02")).toBe(1);
  });
});

describe("currentStreak", () => {
  const counts = applicationsPerDay([
    app("2026-10-30"),
    app("2026-10-30"),
    app("2026-10-31"),
    app("2026-10-31"),
    app("2026-11-01"),
    app("2026-11-01"),
    app("2026-11-02"),
    app("2026-11-02"),
  ]);

  test("a streak through yesterday survives an empty today", () => {
    expect(currentStreak(counts, 2, "2026-11-03")).toBe(4);
  });

  test("meeting today's goal extends it", () => {
    const withToday = new Map(counts).set("2026-11-03", 2);
    expect(currentStreak(withToday, 2, "2026-11-03")).toBe(5);
  });

  test("a missed day breaks it", () => {
    expect(currentStreak(counts, 2, "2026-11-05")).toBe(0);
  });

  test("crosses month boundaries", () => {
    expect(currentStreak(counts, 2, "2026-11-01")).toBe(3);
  });

  test("a higher goal counts fewer days", () => {
    expect(currentStreak(counts, 3, "2026-11-03")).toBe(0);
  });
});

describe("bestStreak", () => {
  test("finds the longest run, not the latest", () => {
    const counts = applicationsPerDay([
      app("2026-09-01"),
      app("2026-09-02"),
      app("2026-09-03"),
      app("2026-09-10"),
    ]);
    expect(bestStreak(counts, 1)).toBe(3);
  });

  test("is zero with nothing met", () => {
    expect(bestStreak(applicationsPerDay([app("2026-09-01")]), 2)).toBe(0);
  });
});

test("lastDays ends on today, oldest first", () => {
  expect(lastDays("2026-03-01", 3).join(",")).toBe("2026-02-27,2026-02-28,2026-03-01");
});
