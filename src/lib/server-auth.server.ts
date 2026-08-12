// Validate a Supabase bearer JWT on a raw server route (the calendar endpoints in
// src/server.ts run ahead of the app's function middleware, so they authenticate
// themselves). Mirrors src/integrations/supabase/auth-middleware.ts.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = () => process.env.SUPABASE_URL || "https://ojhxziejichxbubmdxdb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = () =>
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qaHh6aWVqaWNoeGJ1Ym1keGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMDg5OTYsImV4cCI6MjEwMDg4NDk5Nn0.jxrFD6umHs4CTWmLPl647Vb2wldHqf5jOGC-FEDunM8";

/** Return the authenticated user's id for a request's Bearer token, or null. */
export async function authenticateBearer(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const jwt = authHeader.slice("Bearer ".length);
  if (!jwt || jwt.split(".").length !== 3) return null;

  const supabase = createClient<Database>(SUPABASE_URL(), SUPABASE_PUBLISHABLE_KEY(), {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(jwt);
  const userId = data?.claims?.sub;
  return error || !userId ? null : (userId as string);
}
