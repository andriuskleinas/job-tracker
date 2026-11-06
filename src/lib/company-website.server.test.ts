import { describe, expect, test } from "bun:test";
import { cleanCompanyName, nameKey, pickSuggestion } from "@/lib/company-website.server";

describe("cleanCompanyName", () => {
  test("drops legal forms, keeps the name", () => {
    expect(cleanCompanyName("Revolut Ltd")).toBe("Revolut");
    expect(cleanCompanyName("Acme, Inc.")).toBe("Acme");
    expect(cleanCompanyName("Kilo Health UAB")).toBe("Kilo Health");
    expect(cleanCompanyName("Siemens AG")).toBe("Siemens");
    expect(cleanCompanyName("  Nord   Security ")).toBe("Nord Security");
    expect(cleanCompanyName("Bolt")).toBe("Bolt");
  });
});

describe("nameKey", () => {
  test("matches across case, punctuation, accents and a .com suffix", () => {
    expect(nameKey("Wix.com")).toBe(nameKey("Wix"));
    expect(nameKey("ACME Robotics")).toBe(nameKey("Acme Robotics"));
    expect(nameKey("Société Générale")).toBe(nameKey("Societe Generale"));
  });
});

describe("pickSuggestion", () => {
  const wix = [
    { name: "Wix Answers", domain: "wixanswers.com" },
    { name: "Wix.com", domain: "wix.com" },
  ];

  test("takes the suggestion named like the company, not just the first", () => {
    expect(pickSuggestion("Wix", wix)).toBe("wix.com");
  });

  test("returns nothing when no name matches, rather than a lookalike", () => {
    expect(pickSuggestion("Wixie", wix)).toBeNull();
    expect(pickSuggestion("", wix)).toBeNull();
  });
});
