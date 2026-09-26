/**
 * `/logo?domain=…` — the fallback for company logos Google's favicon service
 * doesn't know. Some sites (lupasearch.com, for one) only declare their icon in
 * a `<link rel="icon">` at a non-standard path and have no `/favicon.ico`, so
 * the aggregators index nothing and the card falls back to a monogram. This
 * reads the site's homepage and redirects to the best icon it declares.
 *
 * It only ever answers with a redirect, never proxies bytes, so the browser
 * loads the icon itself; the one thing we fetch server-side is a homepage.
 */

const FETCH_TIMEOUT_MS = 5000;
/** Icons are declared in <head>; no need to read a whole page to find them. */
const MAX_HTML_BYTES = 256 * 1024;
const ONE_DAY = 60 * 60 * 24;

/**
 * Accept only a plain public DNS name: no IP literals, ports, localhost or
 * single-label hosts, so the endpoint can't be pointed at internal addresses.
 */
export function isPublicHostname(domain: string): boolean {
  if (domain.length > 253) return false;
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(domain)) return false;
  if (/^[\d.]+$/.test(domain)) return false;
  return !/(^|\.)(localhost|local|internal)$/i.test(domain);
}

type IconCandidate = { href: string; size: number; rank: number };

/**
 * Pick the best icon a page declares. Larger declared sizes win; with no sizes,
 * prefer apple-touch-icon (usually 180px) over a plain icon (often 16/32px).
 */
export function pickIconHref(html: string): string | null {
  const candidates: IconCandidate[] = [];
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = attr(tag, "rel")?.toLowerCase();
    const href = attr(tag, "href");
    if (!rel || !href) continue;
    const rels = rel.split(/\s+/);
    const isTouch = rels.includes("apple-touch-icon") || rels.includes("apple-touch-icon-precomposed");
    if (!isTouch && !rels.includes("icon")) continue;
    const sizes = attr(tag, "sizes") ?? "";
    const size = Math.max(0, ...[...sizes.matchAll(/(\d+)x\d+/gi)].map((m) => Number(m[1])));
    candidates.push({ href, size, rank: isTouch ? 1 : 0 });
  }
  candidates.sort((a, b) => b.size - a.size || b.rank - a.rank);
  return candidates[0]?.href ?? null;
}

/** Read one attribute from a tag, quoted or bare (`href=/images/x.png`). */
function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  const value = m ? (m[1] ?? m[2] ?? m[3]) : null;
  return value?.trim() || null;
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_HTML_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(buf);
}

async function findIconUrl(domain: string): Promise<string | null> {
  const res = await fetch(`https://${domain}/`, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; JobTrackerLogoBot/1.0)", accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return null;
  const href = pickIconHref(await readCapped(res));
  if (!href) return null;
  // Resolve against the final URL, in case the homepage redirected elsewhere.
  const icon = new URL(href, res.url);
  return icon.protocol === "https:" ? icon.toString() : null;
}

export async function handleLogo(request: Request): Promise<Response> {
  const domain = new URL(request.url).searchParams.get("domain")?.trim().toLowerCase() ?? "";
  if (!isPublicHostname(domain)) return new Response("Bad domain", { status: 400 });

  let icon: string | null = null;
  try {
    icon = await findIconUrl(domain);
  } catch {
    icon = null;
  }
  // Cache both outcomes at the edge: logos rarely change, and a miss shouldn't
  // re-fetch the homepage on every board render.
  const cache = `public, max-age=${ONE_DAY}, s-maxage=${ONE_DAY * 7}`;
  if (!icon) return new Response("No icon", { status: 404, headers: { "cache-control": cache } });
  return new Response(null, { status: 302, headers: { location: icon, "cache-control": cache } });
}
