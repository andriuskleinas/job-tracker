/**
 * Company logo from a stored website. Unlike guessing a domain from the company
 * name, a real URL resolves reliably through Google's favicon service, so the
 * card can show a proper mark and fall back to a monogram only on a typo.
 */

/** Requested favicon size — ask Google for the sharpest version it has. */
export const LOGO_SIZE = 64;

/**
 * Google serves a 16×16 generic globe when a domain has no real favicon, and it
 * ignores the requested size for that placeholder. Real marks come back at
 * whatever size Google holds (often 32 or 48, not always the requested 64), so
 * the "is this a real logo" test is "bigger than the globe", not "as big as we
 * asked for". Anything at or below this counts as a miss and we show a monogram.
 */
export const GENERIC_FAVICON_SIZE = 16;

/** Pull a bare hostname (no scheme, no `www.`, no path) from a user-typed URL. */
export function domainFromWebsite(website: string | null | undefined): string | null {
  const trimmed = website?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return url.hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

export function faviconUrl(website: string | null | undefined): string | null {
  const domain = domainFromWebsite(website);
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=${LOGO_SIZE}` : null;
}
