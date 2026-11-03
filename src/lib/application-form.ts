/**
 * Validation for a new application, shared by the New application dialog and
 * the CSV import so the two can never disagree about what a valid row is.
 */
import { z } from "zod";
import { STATUSES } from "./status";
import { JOB_TYPES } from "./job-location";

// Only company and position are required — location, website, notes and the
// job ad are all optional, so a role can be logged in a few seconds.
export const applicationSchema = z.object({
  company: z.string().trim().min(1, "Company is required").max(120),
  position: z.string().trim().min(1, "Position is required").max(120),
  status: z.enum(STATUSES, { errorMap: () => ({ message: "Select application status" }) }),
  application_date: z.string().min(1, "Date is required"),
  website: z.string().trim().max(255).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  job_type: z.enum(JOB_TYPES).or(z.literal("")).optional(),
  country: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
});

// The New application dialog can also seed a first follow-up task, linked to the
// application that gets created. Both task fields are optional.
export const newApplicationSchema = applicationSchema.extend({
  task_title: z.string().trim().max(200, "Task title must be 200 characters or fewer").optional(),
  task_due_date: z.string().optional(),
});

export type NewApplicationValues = z.infer<typeof newApplicationSchema>;
