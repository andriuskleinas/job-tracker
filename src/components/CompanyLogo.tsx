import { useState } from "react";
import { faviconUrl, GENERIC_FAVICON_SIZE, siteIconUrl } from "@/lib/company-logo";
import { cn } from "@/lib/utils";

/**
 * A company's real mark, resolved from its website, with a monogram fallback.
 *
 * This lives here rather than inside ApplicationCard because it is now used in
 * two places that must agree: the board, and the marketing homepage. The
 * homepage used to draw its own initial-in-a-square, so the product's own
 * screenshots showed letters where the real app shows logos — the preview
 * looked like a mockup of the app instead of the app. One component means the
 * fallback rule, the tile shape and the white plate behind a transparent
 * favicon can only ever be decided once.
 *
 * The white plate is not themed. Favicons are supplied as-is and most are
 * drawn for a light background, so a dark tile behind one turns dark marks
 * invisible; the monogram fallback, which we do control, uses the theme.
 */
const SIZES = {
  sm: { box: "h-9 w-9 rounded-md text-sm", px: 36 },
  md: { box: "h-11 w-11 rounded-lg text-base", px: 44 },
} as const;

export function CompanyLogo({
  company,
  website,
  size = "sm",
  dim,
  className,
}: {
  company: string;
  website: string | null;
  size?: keyof typeof SIZES;
  /** Mute the monogram for a closed row, so history recedes on the board. */
  dim?: boolean;
  className?: string;
}) {
  // 0 = Google's favicon service, 1 = the site's own declared icon, 2 = monogram.
  const [attempt, setAttempt] = useState(0);
  const url = attempt === 0 ? faviconUrl(website) : attempt === 1 ? siteIconUrl(website) : null;
  const showImg = !!url;
  const next = () => setAttempt((a) => a + 1);
  const initial = company.trim().charAt(0).toUpperCase() || "?";
  const { box, px } = SIZES[size];

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden border font-medium",
        box,
        showImg ? "bg-white" : "bg-muted",
        dim ? "text-muted-foreground" : "text-foreground/70",
        className,
      )}
    >
      {showImg ? (
        <img
          key={url}
          src={url}
          alt=""
          width={px}
          height={px}
          loading="lazy"
          className="h-full w-full object-contain p-1"
          onError={next}
          onLoad={(e) => {
            // A domain Google has no favicon for comes back as a 16px generic
            // globe — treat only that (not a smaller-but-real mark) as a miss.
            // The site's own icon is taken at any size.
            if (attempt === 0 && e.currentTarget.naturalWidth === GENERIC_FAVICON_SIZE) next();
          }}
        />
      ) : (
        initial
      )}
    </div>
  );
}
