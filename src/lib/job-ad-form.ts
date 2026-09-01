/**
 * The job-ad form contract: how the block is held in form state, how it is
 * validated, and how it converts to and from table columns.
 *
 * Deliberately free of React so both callers can share it — the forms in the
 * app, and the `/clip` endpoint the browser extension posts to. One schema,
 * one converter, no chance of the two surfaces disagreeing about what a valid
 * capture looks like.
 */
import { z } from "zod";

/**
 * The job-ad block, as the forms hold it. Numbers stay strings here because
 * that is what an `<input>` gives you; the callers coerce on save.
 */
export type JobAdValue = {
  job_url: string;
  description: string;
  requirements: string;
  salary_min: string;
  salary_max: string;
  salary_currency: string;
  salary_period: string;
  salary_source: string;
};

export const EMPTY_JOB_AD: JobAdValue = {
  job_url: "",
  description: "",
  requirements: "",
  salary_min: "",
  salary_max: "",
  salary_currency: "",
  salary_period: "",
  salary_source: "",
};

/** A paste longer than this is a whole careers site, not one ad. */
export const MAX_AD_LENGTH = 60_000;

/**
 * Validation for the job-ad block, shared by the create and edit forms and
 * mirroring the check constraints on the table. The currency rule is the one
 * that isn't in the database: a number with no currency is technically valid
 * and practically useless once someone is tracking roles in three countries.
 */
export const jobAdSchema = z
  .object({
    job_url: z.string().trim().max(1000).optional().or(z.literal("")),
    description: z
      .string()
      .max(MAX_AD_LENGTH, `Job description must be ${MAX_AD_LENGTH / 1000}k characters or fewer`)
      .optional()
      .or(z.literal("")),
    requirements: z.string().max(20_000).optional().or(z.literal("")),
    salary_min: z.string().optional().or(z.literal("")),
    salary_max: z.string().optional().or(z.literal("")),
    salary_currency: z.string().optional().or(z.literal("")),
    salary_period: z.string().optional().or(z.literal("")),
    salary_source: z.string().optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    const min = v.salary_min?.trim() ? Number(v.salary_min) : null;
    const max = v.salary_max?.trim() ? Number(v.salary_max) : null;

    for (const [key, amount] of [
      ["salary_min", min],
      ["salary_max", max],
    ] as const) {
      if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "Salary must be a positive number",
        });
      }
    }

    if (min !== null && max !== null && min > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["salary_max"],
        message: "The top of the range can't be below the bottom",
      });
    }

    if ((min !== null || max !== null) && !v.salary_currency?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["salary_currency"],
        message: "Pick a currency — a bare number can't be compared later",
      });
    }
  });

/**
 * Turn the form's strings into the columns the table wants.
 *
 * `captured_at` is stamped the first time an ad body is saved and left alone
 * afterwards, so the UI's "captured 12 Aug" keeps meaning the day the ad was
 * taken rather than the day someone last fixed a typo in it.
 */
export function jobAdColumns(value: JobAdValue, existingCapturedAt?: string | null) {
  const description = value.description.trim();
  const min = value.salary_min.trim();
  const max = value.salary_max.trim();

  return {
    job_url: value.job_url.trim() || null,
    description: description || null,
    requirements: value.requirements.trim() || null,
    salary_min: min ? Number(min) : null,
    salary_max: max ? Number(max) : null,
    salary_currency: value.salary_currency.trim() || null,
    salary_period: value.salary_period.trim() || null,
    salary_source: value.salary_source.trim() || null,
    captured_at: description ? (existingCapturedAt ?? new Date().toISOString()) : null,
  };
}

export type JobAdColumns = ReturnType<typeof jobAdColumns>;

/** Read the job-ad block back out of a loaded row. */
export function jobAdFromRow(row: Partial<JobAdColumns>): JobAdValue {
  return {
    job_url: row.job_url ?? "",
    description: row.description ?? "",
    requirements: row.requirements ?? "",
    salary_min: row.salary_min?.toString() ?? "",
    salary_max: row.salary_max?.toString() ?? "",
    salary_currency: row.salary_currency ?? "",
    salary_period: row.salary_period ?? "",
    salary_source: row.salary_source ?? "",
  };
}
