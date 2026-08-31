import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchProfile } from "@/lib/profile";

/**
 * The zone to measure every role against: the one saved in Account, falling
 * back to whatever this browser is set to.
 *
 * Returns null until mounted, and callers render nothing in that case. The
 * fallback reads the browser's zone, which the server cannot know — rendering
 * it during SSR would produce different markup on each side and a hydration
 * error. A missing chip for one frame is a better trade than that.
 *
 * Reads the same `["profile"]` cache entry as the navbar and the account page,
 * so this costs no extra request.
 */
export function useUserZone(): string | null {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data } = useQuery({ queryKey: ["profile"], queryFn: fetchProfile });

  if (!mounted) return null;
  return data?.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
