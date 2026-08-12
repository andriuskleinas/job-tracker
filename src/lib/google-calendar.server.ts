// Server-only Google Calendar integration: OAuth connect/disconnect, token storage,
// and pushing tasks to the user's calendar as all-day events. Imported dynamically
// from src/server.ts so it (and the service-role client / node:crypto) never enters
// ordinary SSR requests or the client bundle.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  shouldHaveEvent,
  taskEventDescription,
  taskEventSummary,
  taskEventTiming,
  type TaskEventInput,
} from "./task-event";
import { authenticateBearer } from "./server-auth.server";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3/calendars";
const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.events"];
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes to complete the consent round-trip

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function googleClient(): { id: string; secret: string } {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error(
      "Google Calendar not configured: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    );
  }
  return { id, secret };
}

function oauthSecret(): string {
  const secret = process.env.CALENDAR_FEED_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Missing CALENDAR_FEED_SECRET or SUPABASE_SERVICE_ROLE_KEY.");
  return secret;
}

function redirectUri(origin: string): string {
  return `${origin}/calendar/google/callback`;
}

// ---------------------------------------------------------------------------
// OAuth `state` — HMAC-signed, short-lived, single-use-ish (nonce + expiry)
// ---------------------------------------------------------------------------

type StatePayload = { u: string; e: number; n: string };

export function signState(userId: string): string {
  const payload: StatePayload = {
    u: userId,
    e: Date.now() + STATE_TTL_MS,
    n: randomBytes(8).toString("hex"),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", oauthSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(state: string): string | null {
  const dot = state.indexOf(".");
  if (dot <= 0) return null;
  const body = state.slice(0, dot);
  let provided: Buffer;
  try {
    provided = Buffer.from(state.slice(dot + 1), "base64url");
  } catch {
    return null;
  }
  const expected = createHmac("sha256", oauthSecret()).update(body).digest();
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as StatePayload;
    if (!payload.u || typeof payload.e !== "number" || payload.e < Date.now()) return null;
    return payload.u;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Google OAuth + API calls
// ---------------------------------------------------------------------------

export function buildAuthUrl(userId: string, origin: string): string {
  const { id } = googleClient();
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline", // ask for a refresh token
    prompt: "consent", // force a refresh token even on re-consent
    include_granted_scopes: "true",
    state: signState(userId),
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  id_token?: string;
};

async function exchangeCode(code: string, origin: string): Promise<TokenResponse> {
  const { id, secret } = googleClient();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: id,
      client_secret: secret,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as TokenResponse;
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const { id, secret } = googleClient();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: id,
      client_secret: secret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as TokenResponse;
}

async function fetchUserInfo(accessToken: string): Promise<{ sub?: string; email?: string }> {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return {};
  return (await res.json()) as { sub?: string; email?: string };
}

async function revokeToken(token: string): Promise<void> {
  await fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(
    () => {},
  );
}

// ---------------------------------------------------------------------------
// Connection + event-mapping store (service-role only)
// ---------------------------------------------------------------------------

type Connection = {
  user_id: string;
  email: string | null;
  calendar_id: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expiry: string | null;
  scope: string | null;
};

type EventMapping = { task_id: string; event_id: string; calendar_id: string };

/** Untyped service-role client — the new tables aren't in the generated types. */
async function getAdmin(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

export async function getConnection(userId: string): Promise<Connection | null> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("google_calendar_connections")
    .select("user_id, email, calendar_id, access_token, refresh_token, token_expiry, scope")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as Connection | null) ?? null;
}

async function getMapping(userId: string, taskId: string): Promise<EventMapping | null> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("task_calendar_events")
    .select("task_id, event_id, calendar_id")
    .eq("user_id", userId)
    .eq("task_id", taskId)
    .maybeSingle();
  return (data as EventMapping | null) ?? null;
}

async function saveMapping(
  userId: string,
  taskId: string,
  eventId: string,
  calendarId: string,
): Promise<void> {
  const admin = await getAdmin();
  await admin.from("task_calendar_events").upsert(
    {
      task_id: taskId,
      user_id: userId,
      provider: "google",
      event_id: eventId,
      calendar_id: calendarId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "task_id" },
  );
}

async function deleteMapping(userId: string, taskId: string): Promise<void> {
  const admin = await getAdmin();
  await admin.from("task_calendar_events").delete().eq("user_id", userId).eq("task_id", taskId);
}

/** A valid access token, refreshing and persisting a new one when expired. */
async function getValidAccessToken(conn: Connection): Promise<string> {
  const expiry = conn.token_expiry ? new Date(conn.token_expiry).getTime() : 0;
  if (conn.access_token && expiry - 60_000 > Date.now()) return conn.access_token;
  if (!conn.refresh_token) throw new Error("No refresh token; reconnect Google Calendar.");

  const refreshed = await refreshAccessToken(conn.refresh_token);
  const admin = await getAdmin();
  const token_expiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await admin
    .from("google_calendar_connections")
    .update({ access_token: refreshed.access_token, token_expiry })
    .eq("user_id", conn.user_id);
  return refreshed.access_token;
}

// ---------------------------------------------------------------------------
// Calendar event CRUD
// ---------------------------------------------------------------------------

function eventBody(task: TaskEventInput, appUrl: string, tz: string) {
  const timing = taskEventTiming(task);
  const base = {
    summary: taskEventSummary(task),
    description: taskEventDescription(task, appUrl),
    transparency: "transparent", // a to-do shouldn't mark the day "busy"
  };
  // No time → all-day (date-only). With a time → a timed event in the user's zone.
  return timing.allDay
    ? { ...base, start: { date: timing.start }, end: { date: timing.end } }
    : {
        ...base,
        start: { dateTime: timing.start, timeZone: tz },
        end: { dateTime: timing.end, timeZone: tz },
      };
}

/** Create or update the event; returns the (possibly new) event id, or null if the
 *  mapped event is gone and we didn't recreate it here. */
async function pushEvent(
  accessToken: string,
  calendarId: string,
  body: object,
  existingEventId: string | null,
): Promise<string | null> {
  const base = `${CALENDAR_API}/${encodeURIComponent(calendarId)}/events`;
  if (existingEventId) {
    const res = await fetch(`${base}/${encodeURIComponent(existingEventId)}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return ((await res.json()) as { id: string }).id;
    // 404/410 → the event was deleted in Google; fall through to create a fresh one.
    if (res.status !== 404 && res.status !== 410) {
      throw new Error(`Google event update failed: ${res.status} ${await res.text()}`);
    }
  }
  const res = await fetch(base, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Google event create failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { id: string }).id;
}

async function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  const res = await fetch(
    `${CALENDAR_API}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  // 410/404 mean it's already gone — that's the desired end state.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google event delete failed: ${res.status} ${await res.text()}`);
  }
}

// ---------------------------------------------------------------------------
// Reconciliation — make Google match a task's current state
// ---------------------------------------------------------------------------

type TaskRow = {
  id: string;
  title: string;
  due_date: string | null;
  due_time: string | null;
  duration_minutes: number | null;
  done: boolean;
  task_applications: { application: { company: string; position: string } | null }[];
};

async function loadTask(userId: string, taskId: string): Promise<TaskRow | null> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("tasks")
    .select(
      "id, title, due_date, due_time, duration_minutes, done, task_applications(application:applications(company, position))",
    )
    .eq("user_id", userId)
    .eq("id", taskId)
    .maybeSingle();
  return (data as TaskRow | null) ?? null;
}

function toEventInput(task: TaskRow): TaskEventInput {
  return {
    id: task.id,
    title: task.title,
    due_date: task.due_date,
    due_time: task.due_time,
    duration_minutes: task.duration_minutes,
    done: task.done,
    applications: task.task_applications
      .map((ta) => ta.application)
      .filter((a): a is { company: string; position: string } => !!a),
  };
}

/** The user's event timezone: profile zone, else the browser zone the client sent,
 *  else UTC. Only consulted for timed tasks. */
async function resolveTimeZone(userId: string, browserTz?: string): Promise<string> {
  const admin = await getAdmin();
  const { data } = await admin.from("profiles").select("time_zone").eq("id", userId).maybeSingle();
  return (data as { time_zone: string | null } | null)?.time_zone || browserTz || "UTC";
}

export type ReconcileResult = "created" | "updated" | "deleted" | "noop" | "not_connected";

/**
 * Reconcile a single task with Google. Safe to call after any task change: it reads
 * the task's current state and makes the calendar match — creating, updating, or
 * removing the event. A no-op when the user hasn't connected Google.
 */
export async function reconcileTask(
  userId: string,
  taskId: string,
  { deleted = false, appUrl, tz }: { deleted?: boolean; appUrl: string; tz?: string },
): Promise<ReconcileResult> {
  const conn = await getConnection(userId);
  if (!conn) return "not_connected";

  const mapping = await getMapping(userId, taskId);

  // The task row is gone (delete) or shouldn't have an event (done / undated):
  // remove any event we created for it.
  const task = deleted ? null : await loadTask(userId, taskId);
  const wantEvent = task ? shouldHaveEvent(task) : false;

  if (!wantEvent) {
    if (mapping) {
      const accessToken = await getValidAccessToken(conn);
      await deleteEvent(accessToken, mapping.calendar_id, mapping.event_id);
      await deleteMapping(userId, taskId);
      return "deleted";
    }
    return "noop";
  }

  const accessToken = await getValidAccessToken(conn);
  const calendarId = mapping?.calendar_id ?? conn.calendar_id;
  const input = toEventInput(task as TaskRow);
  // Timezone only matters for timed tasks — skip the profile lookup for all-day ones.
  const zone = taskEventTiming(input).allDay ? "UTC" : await resolveTimeZone(userId, tz);
  const eventId = await pushEvent(
    accessToken,
    calendarId,
    eventBody(input, appUrl, zone),
    mapping?.event_id ?? null,
  );
  if (eventId) await saveMapping(userId, taskId, eventId, calendarId);
  return mapping ? "updated" : "created";
}

/** Push every open, dated task (used once right after connecting). Best-effort. */
export async function backfillTasks(userId: string, appUrl: string): Promise<void> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("tasks")
    .select("id")
    .eq("user_id", userId)
    .eq("done", false)
    .not("due_date", "is", null);
  const ids = ((data as { id: string }[] | null) ?? []).map((r) => r.id);
  for (const id of ids) {
    try {
      await reconcileTask(userId, id, { appUrl });
    } catch (e) {
      console.error("[google-calendar] backfill failed for task", id, e);
    }
  }
}

// ---------------------------------------------------------------------------
// Route handlers (wired into src/server.ts)
// ---------------------------------------------------------------------------

/** POST /calendar/google/auth-url — bearer; returns the Google consent URL. */
export async function handleGoogleAuthUrl(request: Request): Promise<Response> {
  const userId = await authenticateBearer(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return Response.json({ url: buildAuthUrl(userId, new URL(request.url).origin) });
  } catch (e) {
    console.error("[google-calendar] auth-url failed", e);
    return Response.json({ error: "Google Calendar is not configured" }, { status: 500 });
  }
}

/** GET /calendar/google/callback — public; Google redirects here after consent. */
export async function handleGoogleCallback(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const origin = url.origin;
  const back = (status: string) => Response.redirect(`${origin}/tasks?calendar=${status}`, 302);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (url.searchParams.get("error") || !code || !state) return back("error");

  const userId = verifyState(state);
  if (!userId) return back("error");

  try {
    const tokens = await exchangeCode(code, origin);
    const info = await fetchUserInfo(tokens.access_token);
    const admin = await getAdmin();
    await admin.from("google_calendar_connections").upsert(
      {
        user_id: userId,
        google_sub: info.sub ?? null,
        email: info.email ?? null,
        calendar_id: "primary",
        access_token: tokens.access_token,
        // On re-consent Google may omit the refresh token; keep the stored one if so.
        ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
        token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        scope: tokens.scope ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    await backfillTasks(userId, origin).catch((e) =>
      console.error("[google-calendar] backfill error", e),
    );
    return back("connected");
  } catch (e) {
    console.error("[google-calendar] callback failed", e);
    return back("error");
  }
}

/** GET /calendar/google/status — bearer; connection state for the UI. */
export async function handleGoogleStatus(request: Request): Promise<Response> {
  const userId = await authenticateBearer(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const conn = await getConnection(userId);
  return Response.json({ connected: !!conn, email: conn?.email ?? null });
}

/** POST /calendar/google/disconnect — bearer; revoke + forget the connection. */
export async function handleGoogleDisconnect(request: Request): Promise<Response> {
  const userId = await authenticateBearer(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const conn = await getConnection(userId);
  if (conn?.refresh_token) await revokeToken(conn.refresh_token);
  const admin = await getAdmin();
  await admin.from("google_calendar_connections").delete().eq("user_id", userId);
  return Response.json({ ok: true });
}

/** POST /calendar/google/sync — bearer; reconcile one task after a change. */
export async function handleGoogleSync(request: Request): Promise<Response> {
  const userId = await authenticateBearer(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let body: { taskId?: string; deleted?: boolean; tz?: string };
  try {
    body = (await request.json()) as { taskId?: string; deleted?: boolean; tz?: string };
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  if (!body.taskId) return Response.json({ error: "taskId required" }, { status: 400 });
  try {
    const result = await reconcileTask(userId, body.taskId, {
      deleted: !!body.deleted,
      appUrl: new URL(request.url).origin,
      tz: typeof body.tz === "string" ? body.tz : undefined,
    });
    return Response.json({ result });
  } catch (e) {
    console.error("[google-calendar] sync failed", e);
    return Response.json({ error: "Sync failed" }, { status: 500 });
  }
}
