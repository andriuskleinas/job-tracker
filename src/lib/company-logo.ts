/**
 * Company logo from a stored website. Unlike guessing a domain from the company
 * name, a real URL resolves reliably through Google's favicon service, so the
 * card can show a proper mark and fall back to a monogram only on a typo.
 */

/** Requested favicon size; also the "real logo vs. generic globe" threshold. */
export const LOGO_SIZE = 64;

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
