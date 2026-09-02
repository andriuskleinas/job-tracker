import { beforeAll, describe, expect, test } from "bun:test";
import { signClipToken, verifyClipToken } from "@/lib/extension.server";
import { signFeedToken, verifyFeedToken } from "@/lib/calendar-feed.server";

beforeAll(() => {
  process.env.CALENDAR_FEED_SECRET = "test-secret-do-not-use-in-prod";
});

describe("extension pairing tokens", () => {
  test("round-trips a signed token back to its user id", () => {
    const token = signClipToken("user-123");
    expect(verifyClipToken(token)).toBe("user-123");
  });

  test("rejects a tampered signature", () => {
    const [payload, sig] = signClipToken("user-123").split(".");
    const flipped = sig.at(-1) === "A" ? "B" : "A";
    expect(verifyClipToken(`${payload}.${sig.slice(0, -1)}${flipped}`)).toBeNull();
  });

  test("rejects malformed tokens without throwing", () => {
    expect(verifyClipToken("")).toBeNull();
    expect(verifyClipToken("no-dot-here")).toBeNull();
    expect(verifyClipToken(".onlysig")).toBeNull();
  });
});

describe("token domain separation", () => {
  // A calendar feed URL is meant to be handed to a third party (Google
  // Calendar); a clip token authorizes writes. They're both HMACs under the
  // same key, so this is the property that actually keeps them apart.
  test("a calendar feed token is not accepted as a clip token", () => {
    const feedToken = signFeedToken("user-123");
    expect(verifyClipToken(feedToken)).toBeNull();
  });

  test("a clip token is not accepted as a calendar feed token", () => {
    const clipToken = signClipToken("user-123");
    expect(verifyFeedToken(clipToken)).toBeNull();
  });
});
