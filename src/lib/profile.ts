import { supabase } from "@/integrations/supabase/client";

/** The account profile as the UI consumes it — always with a resolved email. */
export type AccountProfile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  country: string | null;
  city: string | null;
  time_zone: string | null;
};

/**
 * Load the signed-in user's profile row, falling back to the auth record's
 * email when the mirrored `profiles.email` is missing. Returns null when
 * nobody is signed in. Shared by the navbar avatar and the account page so
 * they read from one cache entry (queryKey `["profile"]`).
 */
export async function fetchProfile(): Promise<AccountProfile | null> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;

  return {
    id: user.id,
    email: data?.email ?? user.email ?? null,
    first_name: data?.first_name ?? null,
    last_name: data?.last_name ?? null,
    nickname: data?.nickname ?? null,
    country: data?.country ?? null,
    city: data?.city ?? null,
    time_zone: data?.time_zone ?? null,
  };
}

type NameFields = Pick<AccountProfile, "first_name" | "last_name" | "nickname" | "email">;

/**
 * What to call the user in the UI. A nickname wins when set; otherwise the
 * full name, then the email's local part, then a generic fallback.
 */
export function accountDisplayName(p: NameFields | null | undefined): string {
  const nickname = p?.nickname?.trim();
  if (nickname) return nickname;
  const full = [p?.first_name, p?.last_name]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(" ");
  if (full) return full;
  const email = p?.email?.trim();
  if (email) return email.split("@")[0];
  return "Account";
}

/** Up-to-two-letter avatar initials derived from the display name. */
export function accountInitials(p: NameFields | null | undefined): string {
  const label = accountDisplayName(p);
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return label.slice(0, 2).toUpperCase();
}
