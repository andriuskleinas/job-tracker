/**
 * Open collapsed sections before reading the page.
 *
 * Job boards routinely truncate the ad behind a "…more" control, and the hidden
 * half genuinely is not in the DOM until it is clicked. Reading without
 * expanding doesn't just lose text — it makes the real ad too small to win
 * against the page furniture around it, so the capture silently attaches to the
 * wrong block entirely and picks up a neighbouring listing's salary.
 *
 * This clicks only controls whose visible label says "show more", never
 * anything that could submit, apply or navigate. The user has clicked the
 * extension on a page they are already looking at; expanding a description is
 * exactly what they would do by hand a second later.
 */

/** Labels that mean "reveal the rest of this text". */
const EXPAND_LABEL =
  /^(?:…|\.{3})?\s*(?:see|show|read|view)?\s*more\b|^…$|^\.{3}$|^rodyti\s+daugiau$|^daugiau$|^skaityti\s+daugiau$|^pla[cč]iau$|^i[sš]sami(?:au|ai)$/i;

/**
 * Anything that acts rather than reveals. Checked first and independently of
 * the label match, so a button reading "Show more jobs — Apply now" is skipped
 * rather than clicked on a technicality.
 */
const NEVER_CLICK =
  /apply|submit|send|save|sign\s?(?:in|up)|log\s?in|register|follow|connect|message|subscribe|delete|remove|report|premium|insight|match\s+details|tailor|stand\s+out|compare|kandidatuoti|prisijungti|registruotis|i[sš]saugoti|si[uų]sti|pateikti/i;

/** Controls known to expand a job description, by markup rather than label. */
const EXPAND_SELECTORS = [
  ".jobs-description__footer-button",
  ".show-more-less-html__button--more",
  '[data-tracking-control-name*="show_more"]',
  '[aria-label*="see more" i]',
  '[aria-label*="show more" i]',
];

function labelOf(el: Element): string {
  const aria = el.getAttribute("aria-label") ?? "";
  const text = (el as HTMLElement).innerText || el.textContent || "";
  return (aria || text).trim().replace(/\s+/g, " ");
}

/**
 * Expand what we can, then let the page settle. Resolves with how many
 * controls were clicked, so the UI can say the description was expanded.
 */
export async function expandCollapsedSections(doc: Document, max = 3): Promise<number> {
  const seen = new Set<Element>();
  const candidates: Element[] = [];

  for (const selector of EXPAND_SELECTORS) {
    for (const el of Array.from(doc.querySelectorAll(selector))) candidates.push(el);
  }
  for (const el of Array.from(doc.querySelectorAll('button, [role="button"], a[role="button"]'))) {
    candidates.push(el);
  }

  let clicked = 0;
  for (const el of candidates) {
    if (clicked >= max) break;
    if (seen.has(el)) continue;
    seen.add(el);

    const label = labelOf(el);
    // A long label is a paragraph that happens to be clickable, not a control.
    if (label.length > 40) continue;
    if (NEVER_CLICK.test(label)) continue;

    const matchedBySelector = EXPAND_SELECTORS.some((s) => el.matches(s));
    if (!matchedBySelector && !EXPAND_LABEL.test(label)) continue;
    // An already-open disclosure has nothing to reveal.
    if (el.getAttribute("aria-expanded") === "true") continue;

    try {
      (el as HTMLElement).click();
      clicked++;
    } catch {
      /* A control that refuses to be clicked is not worth failing the capture over. */
    }
  }

  // Give the page a moment to render what was revealed.
  if (clicked > 0) await new Promise((resolve) => setTimeout(resolve, 400));
  return clicked;
}
