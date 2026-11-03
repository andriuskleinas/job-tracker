import { describe, expect, test } from "bun:test";
import { readJobLink, readQuickFill } from "./quick-fill";

/** Compare just the named fields, as one readable string. */
function pick<T extends object>(value: T, expected: Partial<T>) {
  const actual = Object.fromEntries(Object.keys(expected).map((k) => [k, value[k as keyof T]]));
  expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
}

describe("readJobLink", () => {
  test("reads company, title and office out of a Workday link", () => {
    const fill = readJobLink(
      "https://nasdaq.wd1.myworkdayjobs.com/Global_External_Site/job/Lithuania---Vilnius/AI-Platform-Product-Manager_R0012345",
    );
    pick(fill, {
      company: "Nasdaq",
      position: "AI Platform Product Manager",
      city: "Vilnius",
      country: "Lithuania",
      website: null,
    });
  });

  test("handles multi-word cities and country aliases written with hyphens", () => {
    const fill = readJobLink(
      "https://acme.wd5.myworkdayjobs.com/en-US/careers/job/USA---New-York-NY/Senior-Analyst_JR-104455",
    );
    pick(fill, {
      city: "New York",
      country: "United States",
      position: "Senior Analyst",
    });
  });

  test("names the employer from applicant-tracking slugs, without inventing a website", () => {
    pick(readJobLink("https://boards.greenhouse.io/acme-corp/jobs/123"), {
      company: "Acme Corp",
      website: null,
    });
    pick(readJobLink("https://jobs.lever.co/vinted/0a1b-2c3d"), {
      company: "Vinted",
      website: null,
    });
    pick(readJobLink("https://jobs.smartrecruiters.com/BoschGroup/744000012345-product-owner-ai"), {
      company: "BoschGroup",
      position: "Product Owner AI",
    });
  });

  test("reads title and company from a long-form LinkedIn link only", () => {
    pick(readJobLink("https://www.linkedin.com/jobs/view/product-manager-at-nasdaq-4012345678"), {
      company: "Nasdaq",
      position: "Product Manager",
      website: null,
    });
    pick(readJobLink("https://www.linkedin.com/jobs/view/4012345678/"), {
      company: null,
      position: null,
      website: null,
    });
  });

  test("takes the website from a link on the employer's own domain", () => {
    pick(readJobLink("https://careers.acme.co.uk/jobs/42"), {
      company: "Acme",
      website: "acme.co.uk",
    });
  });

  test("leaves job boards alone", () => {
    pick(readJobLink("https://www.cvbankas.lt/product-manager-vilniuje-1234567"), {
      company: null,
      website: null,
    });
  });
});

describe("readQuickFill", () => {
  test("a lone link is read as a link, with no ad", () => {
    const fill = readQuickFill("  boards.greenhouse.io/acme/jobs/1  ");
    expect(fill.ad).toBeNull();
    expect(fill.job_url).toBe("https://boards.greenhouse.io/acme/jobs/1");
    expect(fill.company).toBe("Acme");
  });

  test("a single word is not a link", () => {
    const fill = readQuickFill("Nasdaq");
    expect(fill.job_url).toBeNull();
    expect(fill.ad === null).toBe(false);
  });

  test("reads labelled lines, salary and work mode from an ad", () => {
    const fill = readQuickFill(
      [
        "Job title: Senior Product Manager",
        "Company: Vinted",
        "Location: Vilnius, Lithuania",
        "",
        "We work in a hybrid model, three days in the office.",
        "",
        "Requirements",
        "- 5+ years of product management experience",
        "- Strong analytical skills",
        "",
        "Salary: 4000–5500 EUR per month gross",
      ].join("\n"),
    );
    pick(fill, {
      company: "Vinted",
      position: "Senior Product Manager",
      city: "Vilnius",
      country: "Lithuania",
      job_type: "hybrid",
    });
    expect(fill.ad?.salary?.salary_min).toBe(4000);
    expect(fill.ad?.requirements?.includes("5+ years")).toBe(true);
  });

  test("reads the location row a job board prints under the title", () => {
    const fill = readQuickFill(
      [
        "Nasdaq",
        "AI Platform Product Manager",
        "Vilnius, Vilnius, Lithuania · 3 weeks ago · Over 100 applicants",
        "On-site",
        "",
        "About the job",
        "Join us to build the AI platform.",
      ].join("\n"),
    );
    pick(fill, { city: "Vilnius", country: "Lithuania", job_type: "onsite" });
    // No label and no "at" line: the title stays the user's to fill in.
    expect(fill.position).toBeNull();
  });

  test("does not read pronouns as countries", () => {
    const fill = readQuickFill("Join us and help it grow\nWe build tools for teams.");
    expect(fill.country).toBeNull();
  });

  test("reads a 'Title at Company' headline", () => {
    const fill = readQuickFill("Staff Engineer at Wise\n\nAbout the role\nYou will build things.");
    pick(fill, { position: "Staff Engineer", company: "Wise" });
  });

  test("picks up a posting link inside the ad and lets the text win", () => {
    const fill = readQuickFill(
      [
        "Company: Nasdaq Inc.",
        "Apply: https://nasdaq.wd1.myworkdayjobs.com/Global/job/Lithuania---Vilnius/AI-Platform-Product-Manager_R1",
        "Follow us on https://twitter.com/nasdaq",
      ].join("\n"),
    );
    expect(fill.job_url?.includes("myworkdayjobs.com")).toBe(true);
    expect(fill.company).toBe("Nasdaq Inc.");
    expect(fill.position).toBe("AI Platform Product Manager");
    expect(fill.city).toBe("Vilnius");
  });

  test("a bare mention of remote work is not a remote role", () => {
    const fill = readQuickFill("Office in Berlin with occasional remote days.");
    expect(fill.job_type).toBeNull();
    expect(fill.city).toBe("Berlin");
  });
});

describe("requirements headings", () => {
  test("reads a 'Required Qualifications' section", () => {
    const fill = readQuickFill(
      "About the job\nBuild things.\n\nRequired Qualifications\n- 3-5+ years in product management\n- A degree in a related field\n\nBenefits\n- Lunch",
    );
    expect(fill.ad?.requirements?.startsWith("- 3-5+ years")).toBe(true);
  });
});
