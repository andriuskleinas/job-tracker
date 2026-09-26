import { describe, expect, test } from "bun:test";
import { isPublicHostname, pickIconHref } from "@/lib/company-logo.server";

describe("pickIconHref", () => {
  test("prefers the largest declared size, with bare attribute values", () => {
    const html = `<link rel=apple-touch-icon sizes=180x180 href=/images/apple-touch-icon.png>
      <link rel=icon type=image/png sizes=32x32 href=/images/favicon-32x32.png>`;
    expect(pickIconHref(html)).toBe("/images/apple-touch-icon.png");
  });

  test("prefers apple-touch-icon when no sizes are declared", () => {
    const html = `<link rel="icon" href="/f.ico"><link rel="apple-touch-icon" href="/t.png">`;
    expect(pickIconHref(html)).toBe("/t.png");
  });

  test("ignores non-icon links", () => {
    expect(pickIconHref(`<link rel="stylesheet" href="/a.css">`)).toBeNull();
  });
});

describe("isPublicHostname", () => {
  test("accepts ordinary domains", () => {
    expect(isPublicHostname("lupasearch.com")).toBe(true);
    expect(isPublicHostname("capitalica.lt")).toBe(true);
  });

  test("rejects IPs, localhost and single-label hosts", () => {
    for (const d of ["127.0.0.1", "169.254.169.254", "localhost", "intranet", "a.localhost", "x.com:8080"]) {
      expect(isPublicHostname(d)).toBe(false);
    }
  });
});
