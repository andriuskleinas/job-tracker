// Server-only endpoints behind the "Clip to Job Tracker" browser extension.
// Imported dynamically from src/server.ts, like the calendar endpoints, so the
// service-role client and node:crypto never reach the client bundle.
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { authenticateBearer } from "./server-auth.server";
import { jobAdColumns, jobAdSchema, type JobAdValue } from "./job-ad-form";

/**
 * HMAC key for pairing tokens. Same fallback chain as the calendar feed —
 * a dedicated secret if set, otherwise the service-role key that this module
 * already requires. HMAC never exposes its key, so sharing it is safe.
 */
function clipSecret(): string {
  const secret = process.env.CALENDAR_FEED_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error(
      "Extension secret missing: set CALENDAR_FEED_SECRET or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return secret;
}

/**
 * The signed payload is prefixed with a purpose before hashing, and that
 * prefix is the whole point.
 *
 * Calendar feed tokens sign the bare user id, and those tokens are *designed*
 * to be handed to third parties — the user pastes the feed URL into Google
 * Calendar. If this endpoint accepted the same token, anyone holding a feed URL
 * could write applications into that account. Domain separation means a feed
 * token verifies as garbage here and a clip token verifies as garbage there,
 * even though both are HMACs under the same key.
 */
function hmac(userId: string): Buffer {
  return createHmac("sha256", clipSecret()).update(`clip:${userId}`).digest();
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** A stateless per-user pairing token: `base64url(userId).base64url(hmac)`. */
export function signClipToken(userId: string): string {
  return `${base64url(userId)}.${base64url(hmac(userId))}`;
}

/** Verify a pairing token and return its user id, or null if it doesn't check out. */
export function verifyClipToken(token: string): string | null {
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

/* ------------------------------------------------------------------ *
 * CORS
 * ------------------------------------------------------------------ */

/**
 * The extension's origin is `chrome-extension://<id>`, and the id isn't known
 * until the extension is packed — so the origin is matched by scheme rather
 * than pinned to one value. That's sound here because the bearer token is the
 * only credential: no cookies are read, so a hostile page reaching this
 * endpoint still has nothing to authenticate with.
 */
function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  const allowed =
    /^chrome-extension:\/\/[a-z]{32}$/.test(origin) || origin.startsWith("moz-extension://");
  return {
    "access-control-allow-origin": allowed ? origin : "null",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

function json(request: Request, body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders(request) });
}

/** Preflight for the endpoints below. */
export function handleExtensionPreflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

/* ------------------------------------------------------------------ *
 * Pairing
 * ------------------------------------------------------------------ */

/**
 * Issue a pairing token for the signed-in user. Called by the app's own
 * settings page with a Supabase session, never by the extension — the
 * extension only ever holds the token this returns.
 */
export async function handleClipTokenRequest(request: Request): Promise<Response> {
  const userId = await authenticateBearer(request);
  if (!userId) return json(request, { error: "Not signed in" }, 401);
  return json(request, { token: signClipToken(userId) });
}

/**
 * The user's open applications, so the popup can offer "attach to this one"
 * instead of always creating a new row — people clip while researching and
 * again while prepping, and those want different destinations.
 *
 * Wishlist rows are included: the first clip creates one, so leaving them out
 * would hide exactly the row a second clip most wants to attach to.
 *
 * Doubles as the check the extension runs when pairing, so a mistyped code
 * fails at connect time rather than silently at the first clip.
 */
export async function handleClipApplications(request: Request): Promise<Response> {
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const userId = (bearer ? verifyClipToken(bearer) : null) ?? (await authenticateBearer(request));
  if (!userId) return json(request, { error: "Not connected" }, 401);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("applications")
    .select("id, company, position")
    .eq("user_id", userId)
    .in("status", ["wishlist", "applied", "interviewing", "offer"])
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[clip] application list failed", error);
    return json(request, { error: "Could not load applications" }, 500);
  }
  return json(request, data ?? []);
}

/* ------------------------------------------------------------------ *
 * Clip ingest
 * ------------------------------------------------------------------ */

/** Bodies above this are not a job ad; reject before parsing. */
const MAX_BODY_BYTES = 256_000;

/**
 * What the extension may send. The job-ad half reuses {@link jobAdSchema}
 * verbatim — the same contract the web form validates against, so the two
 * surfaces cannot disagree about what a valid capture is.
 */
const clipSchema = z.object({
  company: z.string().trim().min(1).max(120).optional().or(z.literal("")),
  position: z.string().trim().min(1).max(120).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  country: z.string().trim().max(120).optional().or(z.literal("")),
  job_type: z.enum(["remote", "hybrid", "onsite"]).optional().or(z.literal("")),
  /** When set, update this application instead of creating one. */
  application_id: z.string().uuid().optional(),
  ad: jobAdSchema,
});

/**
 * Create or update an application from a clipped posting.
 *
 * Deduping is on (user_id, job_url): clipping the same posting twice updates
 * the row rather than littering the board with copies, which matters because
 * people clip once while researching and again while prepping.
 */
export async function handleClip(request: Request): Promise<Response> {
  if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);

  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  // A pairing token first (what the extension holds), then a Supabase session
  // JWT so the app itself can post here too.
  const userId = (bearer ? verifyClipToken(bearer) : null) ?? (await authenticateBearer(request));
  if (!userId) return json(request, { error: "Not connected" }, 401);

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json(request, { error: "That page is too large to clip" }, 413);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json(request, { error: "Malformed request" }, 400);
  }

  const parsed = clipSchema.safeParse(payload);
  if (!parsed.success) {
    return json(request, { error: parsed.error.issues[0]?.message ?? "Invalid clip" }, 400);
  }

  const { company, position, city, country, job_type, application_id, ad } = parsed.data;
  const columns = jobAdColumns(ad as JobAdValue);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Which row are we writing to? An explicit target wins; otherwise the same
  // ad URL clipped before; otherwise a new application.
  let targetId: string | null = null;
  if (application_id) {
    const { data } = await supabaseAdmin
      .from("applications")
      .select("id, captured_at")
      .eq("id", application_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return json(request, { error: "That application no longer exists" }, 404);
    targetId = data.id;
  } else if (columns.job_url) {
    const { data } = await supabaseAdmin
      .from("applications")
      .select("id")
      .eq("user_id", userId)
      .eq("job_url", columns.job_url)
      .maybeSingle();
    targetId = data?.id ?? null;
  }

  if (targetId) {
    // Preserve the original capture date — a re-clip is not a fresh capture.
    const { data: existing } = await supabaseAdmin
      .from("applications")
      .select("captured_at")
      .eq("id", targetId)
      .maybeSingle();

    // Only overwrite the identity fields this clip actually carries — a clip
    // that couldn't read the company must not blank the one already there.
    const update = {
      ...jobAdColumns(ad as JobAdValue, existing?.captured_at ?? null),
      ...(company ? { company } : {}),
      ...(position ? { position } : {}),
      ...(city ? { city } : {}),
      ...(country ? { country } : {}),
      ...(job_type ? { job_type } : {}),
    };

    const { error } = await supabaseAdmin.from("applications").update(update).eq("id", targetId);
    if (error) {
      console.error("[clip] update failed", error);
      return json(request, { error: "Could not save this clip" }, 500);
    }
    return json(request, { id: targetId, created: false });
  }

  if (!company || !position) {
    return json(request, { error: "A new application needs a company and a job title" }, 400);
  }

  const { data, error } = await supabaseAdmin
    .from("applications")
    .insert({
      user_id: userId,
      company,
      position,
      city: city || null,
      country: country || null,
      job_type: job_type || null,
      // A clip is interest, not an application. The column defaults to
      // `applied`, which was right when clipping was the only way in and wrong
      // now that the board has somewhere to put a job you have merely found:
      // defaulting to `applied` quietly claimed you had sent something you
      // hadn't, and every conversion rate on the dashboard was divided by it.
      // The re-clip path above deliberately does not touch status — clipping a
      // posting again must never drag an interviewing application backwards.
      status: "wishlist" as const,
      ...columns,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[clip] insert failed", error);
    return json(request, { error: "Could not save this clip" }, 500);
  }
  return json(request, { id: data.id, created: true });
}
