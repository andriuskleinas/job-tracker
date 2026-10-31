import { describe, expect, test } from "bun:test";
import { isAuthorizedCronRequest } from "@/lib/keepalive.server";

const req = (authorization?: string) =>
  new Request("https://example.com/cron/keepalive", {
    headers: authorization ? { authorization } : {},
  });

describe("isAuthorizedCronRequest", () => {
  test("allows any request when no CRON_SECRET is set", () => {
    expect(isAuthorizedCronRequest(req(), "")).toBe(true);
  });

  test("requires the matching bearer token when a secret is set", () => {
    expect(isAuthorizedCronRequest(req("Bearer s3cret"), "s3cret")).toBe(true);
    expect(isAuthorizedCronRequest(req("Bearer wrong"), "s3cret")).toBe(false);
    expect(isAuthorizedCronRequest(req(), "s3cret")).toBe(false);
  });
});
