// Daily Supabase keepalive, run by a Vercel cron (vercel.json → /cron/keepalive).
// It backs up the GitHub Action in .github/workflows/supabase-keepalive.yml:
// GitHub turns off scheduled workflows after 60 days with no repo activity, while
// Vercel crons keep running however long the code goes untouched. Both call the
// same record_keepalive_ping() RPC, a real write that resets Supabase's pause timer.

const SUPABASE_URL = () => process.env.SUPABASE_URL || "https://ojhxziejichxbubmdxdb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = () =>
  process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_WmrrRztiCjckh4yU3EtQbw_LUlokhe_";

/**
 * Vercel sends `Authorization: Bearer $CRON_SECRET` on cron calls when that env
 * var is set. Without it the route stays open, which is harmless: the RPC is
 * already callable with the public key and can only bump one timestamp.
 */
export function isAuthorizedCronRequest(
  request: Request,
  secret = process.env.CRON_SECRET,
): boolean {
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function handleKeepalive(request: Request): Promise<Response> {
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
  if (!isAuthorizedCronRequest(request)) return new Response("Unauthorized", { status: 401 });

  const key = SUPABASE_PUBLISHABLE_KEY();
  const res = await fetch(`${SUPABASE_URL()}/rest/v1/rpc/record_keepalive_ping`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) {
    console.error(`record_keepalive_ping failed with HTTP ${res.status}: ${await res.text()}`);
    return Response.json({ ok: false, status: res.status }, { status: 502 });
  }
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
