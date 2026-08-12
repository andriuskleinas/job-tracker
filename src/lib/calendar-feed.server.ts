// Server-only endpoints behind the tasks calendar feed. Imported dynamically from
// src/server.ts so neither the service-role client nor Node crypto is pulled into
// ordinary SSR requests — and never into the client bundle.
import { createHmac, timingSafeEqual } from "node:crypto";
import { buildTasksICS, type CalendarTask } from "./calendar-ics";
import { authenticateBearer } from "./server-auth.server";

/**
 * The HMAC key for feed tokens. A dedicated CALENDAR_FEED_SECRET is preferred, but
 * we fall back to the service-role key (already required for the feed to read
 * tasks) so the feature works with no extra configuration. HMAC never exposes its
 * key, so reusing it is safe.
 */
function feedSecret(): string {
  const secret = process.env.CALENDAR_FEED_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error(
      "Calendar feed secret missing: set CALENDAR_FEED_SECRET or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return secret;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function hmac(userId: string): Buffer {
  return createHmac("sha256", feedSecret()).update(userId).digest();
}

/**
 * A stateless per-user feed token: `base64url(userId).base64url(hmac(userId))`.
 * No DB storage — the signature both authenticates the URL and identifies the
 * user, so the public (auth-less) feed request can be scoped to one person.
 */
export function signFeedToken(userId: string): string {
  return `${base64url(userId)}.${base64url(hmac(userId))}`;
}

/** Verify a feed token and return its user id, or null if it doesn't check out. */
export function verifyFeedToken(token: string): string | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  let userId: string;
  let provided: Buffer;
  try {
    userId = Buffer.from(token.slice(0, dot), "base64url").toString("utf8");
    provided = Buffer.from(token.slice(dot + 1), "base64url");
  } catch {
    return null;
  }
  if (!userId) return null;
  const expected = hmac(userId);
  if (provided.length !== expected.length) return null;
  return timingSafeEqual(provided, expected) ? userId : null;
}

/** The site origin, for absolute back-links inside the .ics. */
function appOrigin(request: Request): string {
  return new URL(request.url).origin;
}

type TaskFeedRow = {
  id: string;
  title: string;
  due_date: string | null;
  due_time: string | null;
  duration_minutes: number | null;
  updated_at: string | null;
  task_applications: { application: { company: string; position: string } | null }[];
};

/**
 * Serve the calendar feed for the user encoded in the URL token. Public (no auth
 * header — calendar apps can't send one), so the token is the only credential.
 * Returns text/calendar; a bad or unknown token is a flat 404.
 */
export async function handleCalendarFeed(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname;
  const token = path.slice("/calendar/tasks/".length).replace(/\.ics$/, "");
  const userId = token ? verifyFeedToken(token) : null;
  if (!userId) return new Response("Not found", { status: 404 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data, error }, { data: profile }] = await Promise.all([
    supabaseAdmin
      .from("tasks")
      .select(
        "id, title, due_date, due_time, duration_minutes, updated_at, task_applications(application:applications(company, position))",
      )
      .eq("user_id", userId)
      .eq("done", false)
      .not("due_date", "is", null)
      .order("due_date", { ascending: true }),
    supabaseAdmin.from("profiles").select("time_zone").eq("id", userId).maybeSingle(),
  ]);

  if (error) {
    console.error("[calendar-feed] task query failed", error);
    return new Response("Unable to build calendar", { status: 500 });
  }

  const tasks: CalendarTask[] = (data as unknown as TaskFeedRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    due_date: row.due_date,
    due_time: row.due_time,
    duration_minutes: row.duration_minutes,
    updated_at: row.updated_at,
    applications: row.task_applications
      .map((ta) => ta.application)
      .filter((a): a is { company: string; position: string } => !!a),
  }));

  const tz = (profile as { time_zone: string | null } | null)?.time_zone || "UTC";
  const ics = buildTasksICS(tasks, { appUrl: appOrigin(request), tz });
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new Response(ics, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      // Calendar clients re-poll on their own schedule; a short cache keeps repeated
      // fetches cheap without letting edits go stale for long.
      "cache-control": "private, max-age=300",
      ...(download
        ? { "content-disposition": 'attachment; filename="job-tracker-tasks.ics"' }
        : {}),
    },
  });
}

/**
 * Return the calling user's feed token as JSON. Authenticated with the Supabase
 * bearer the client already holds (validated the same way as the app's function
 * middleware), so the browser can build the feed URL without ever seeing the
 * server secret.
 */
export async function handleCalendarTokenRequest(request: Request): Promise<Response> {
  const userId = await authenticateBearer(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return Response.json({ token: signFeedToken(userId) });
  } catch (e) {
    console.error("[calendar-feed] token signing failed", e);
    return Response.json({ error: "Calendar sync is not configured" }, { status: 500 });
  }
}
