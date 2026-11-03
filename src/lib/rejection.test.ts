import { describe, expect, test } from "bun:test";
import { summarizeRejections } from "./rejection";

const app = (status: string, tags: string[] | null = null, note: string | null = null) => ({
  status,
  rejection_reason_tags: tags,
  rejection_note: note,
});

describe("summarizeRejections", () => {
  test("counts tags on rejected applications only, most common first", () => {
    const summary = summarizeRejections([
      app("rejected", ["ghosted"]),
      app("rejected", ["ghosted", "salary_mismatch"]),
      app("rejected", ["salary_mismatch", "ghosted"]),
      app("rejected", ["position_filled"]),
      app("applied", ["ghosted"]),
    ]);
    expect(summary.rejected).toBe(4);
    expect(summary.tags.map((t) => `${t.label}:${t.count}`).join(", ")).toBe(
      "Ghosted:3, Salary mismatch:2, Position filled:1",
    );
  });

  test("counts rejections with a tag or a note as having a reason", () => {
    const summary = summarizeRejections([
      app("rejected", ["ghosted"]),
      app("rejected", [], "Wanted Go"),
      app("rejected", [], "   "),
      app("rejected"),
    ]);
    expect(summary.withReason).toBe(2);
  });

  test("keeps an unknown tag key as its own label", () => {
    const [tag] = summarizeRejections([app("rejected", ["legacy_key"])]).tags;
    expect(tag.label).toBe("legacy_key");
    expect(tag.count).toBe(1);
  });

  test("counts a note word once per note and drops filler words", () => {
    const summary = summarizeRejections([
      app("rejected", [], "Salary was too low, salary band fixed."),
      app("rejected", [], "They wanted Go; the salary didn't fit."),
    ]);
    const counts = Object.fromEntries(summary.words.map((w) => [w.word, w.count]));
    expect(counts.salary).toBe(2);
    expect(counts.band).toBe(1);
    expect(counts["didn't"]).toBe(1);
    expect("the" in counts).toBe(false);
    expect("go" in counts).toBe(false);
    expect(summary.words[0].word).toBe("salary");
  });
});
