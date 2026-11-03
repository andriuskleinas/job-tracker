import { useQuery } from "@tanstack/react-query";
import { Briefcase } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { fetchProfile } from "@/lib/profile";
import {
  BRIEFCASE_PATHS,
  BRIEFCASE_TRANSFORM,
  TILE,
  TILE_RADIUS,
  logoTheme,
  shapeElement,
  type LogoTheme,
} from "@/lib/logo-theme";

/**
 * Wordmark: a solid black tile with the one red mark in the system sitting on
 * its corner. Used in the header, the footer and the auth screens. A signed-in
 * user who picked a flag on the account page sees the tile in those colours
 * instead — read from the shared `["profile"]` cache, never fetched here, so
 * signed-out pages always show the standard mark.
 */
export function Logo({ className }: { className?: string }) {
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile,
    enabled: false,
  });
  const theme = logoTheme(profile?.logo_theme);

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoTile theme={theme} />
      <span className="text-[0.95rem] font-semibold tracking-tight">Job Tracker</span>
    </span>
  );
}

/** The tile on its own, standard or flag-coloured. Sized by `className` (default 32px). */
export function LogoTile({
  theme,
  className = "h-8 w-8",
}: {
  theme: LogoTheme | null;
  className?: string;
}) {
  const clipId = useId();

  if (!theme) {
    return (
      <span
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center rounded-lg bg-foreground",
          className,
        )}
      >
        <Briefcase className="h-1/2 w-1/2 text-background" aria-hidden="true" />
        <span
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-background"
          aria-hidden="true"
        />
      </span>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${TILE} ${TILE}`}
      className={cn("inline-block shrink-0", className)}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <rect width={TILE} height={TILE} rx={TILE_RADIUS} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {theme.shapes.map((s, i) => {
          const { tag: Tag, attrs } = shapeElement(s);
          const props = Object.fromEntries(
            Object.entries(attrs).map(([k, val]) => [
              k === "stroke-width" ? "strokeWidth" : k,
              val,
            ]),
          );
          return <Tag key={i} {...props} />;
        })}
        {/* Hairline edge so white-heavy flags (Japan, Finland…) still read as a tile. */}
        <rect
          width={TILE}
          height={TILE}
          rx={TILE_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={1.5}
        />
      </g>
      {/* Briefcase in white over a soft dark outline, legible on any flag. */}
      <g transform={BRIEFCASE_TRANSFORM} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <g stroke="#000" strokeOpacity={0.55} strokeWidth={5}>
          {BRIEFCASE_PATHS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <g stroke="#fff" strokeWidth={2.4}>
          {BRIEFCASE_PATHS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </g>
    </svg>
  );
}
