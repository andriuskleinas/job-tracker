import { beforeAll, describe, expect, test } from "bun:test";
import { signFeedToken, verifyFeedToken } from "@/lib/calendar-feed.server";

beforeAll(() => {
  process.env.CALENDAR_FEED_SECRET = "test-secret-do-not-use-in-prod";
});

describe("calendar feed tokens", () => {
  test("round-trips a signed token back to its user id", () => {
    const token = signFeedToken("user-123");
    expect(verifyFeedToken(token)).toBe("user-123");
  });

  test("rejects a tampered signature", () => {
    const [payload, sig] = signFeedToken("user-123").split(".");
    const flipped = sig.at(-1) === "A" ? "B" : "A";
    expect(verifyFeedToken(`${payload}.${sig.slice(0, -1)}${flipped}`)).toBeNull();
  });

  test("rejects a signature that doesn't match the claimed user id", () => {
    const [, sig] = signFeedToken("user-123").split(".");
    const forgedPayload = Buffer.from("user-456").toString("base64url");
    expect(verifyFeedToken(`${forgedPayload}.${sig}`)).toBeNull();
  });

  test("rejects malformed tokens without throwing", () => {
    expect(verifyFeedToken("")).toBeNull();
    expect(verifyFeedToken("no-dot-here")).toBeNull();
    expect(verifyFeedToken(".onlysig")).toBeNull();
    expect(verifyFeedToken("userid.")).toBeNull();
  });
});
