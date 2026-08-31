# Clip to Job Tracker

A Chrome (MV3) extension that saves the job ad you're looking at — salary,
requirements and the full text — into Job Tracker, before the posting is taken
down.

## Why it exists

LinkedIn, Indeed and Workday can't be read server-side: there is no public API
for job postings at any access tier, and fetching those pages with a user's
session would put their account at risk. The extension sidesteps that entirely
by reading the DOM **already rendered in the tab the user is looking at**. It
makes no request to the job site at all.

## Build

```bash
bun extension/build.ts
```

Output lands in `extension/dist`. Load it via `chrome://extensions` →
Developer mode → **Load unpacked** → select `extension/dist`.

## Connect

1. Job Tracker → **Account** → *Browser extension* → **Show my pairing code**
2. Copy it, open the extension, paste it, **Connect**

The pairing code is a signed token scoped to one user. It is deliberately
**not** the calendar-feed token: feed tokens are designed to be handed to
Google Calendar, so accepting one here would let anyone with a shared feed URL
write applications into the account. Both are HMACs under the same key, but the
clip token hashes a `clip:` prefix, and each verifier rejects the other's
tokens.

## How it's put together

| File | Role |
| --- | --- |
| `manifest.json` | MV3. Permissions: `activeTab`, `scripting`, `storage`. **No `content_scripts`** — nothing runs on any page until the toolbar button is clicked. |
| `src/content.ts` | Injected on click. Reads the DOM, posts the result back, exits. |
| `src/adapters/` | Per-site selectors: Greenhouse, Lever, Ashby, LinkedIn, Workday, and a generic fallback. |
| `src/popup.ts` | Pairing, the review form, and the save. All the logic lives here — there is no service worker, because there is nothing to do in the background. |

The parser is **not** in this folder: the popup imports `src/lib/job-ad.ts`
from the app. One parser serves both the website's paste box and the
extension, so an improvement to salary reading lands in both at once and the
two can never disagree.

### Adapters never hard-fail

Every adapter returns `{ fields, rawText }`. If its selectors miss, `rawText`
falls back to the page's visible text and `fellBack` is set — the shared parser
then reads that exactly as it reads a manual paste. A LinkedIn redesign costs
fidelity (no company name pre-filled), never the capture. The popup says which
happened, so the user knows whether to check the fields.

## Endpoints it talks to

| Route | Purpose |
| --- | --- |
| `POST /clip` | Create or update an application. Dedupes on `(user_id, job_url)`, so re-clipping a posting updates it instead of duplicating. |
| `GET /clip/applications` | Open applications, for the "save to an existing one" picker. Also the check run at pairing, so a mistyped code fails at connect rather than at the first clip. |
| `POST /clip/token` | Mints a pairing code. Called by the app's own account page with a Supabase session — never by the extension. |

Payload validation reuses `jobAdSchema` from `src/lib/job-ad-form.ts`, the same
schema the web form validates against.

## Before submitting to the Chrome Web Store

- [ ] **Privacy policy page** — required for any extension handling user data. Not written yet.
- [ ] **Listing assets** — screenshots (1280×800 or 640×400), a promo tile, a description.
- [ ] **Permission justifications** — short, because of the `activeTab` design: the extension reads a page only when the user clicks the button, and stores only the pairing token.
- [ ] **Replace the placeholder icons** in `extension/icons/` with real artwork.
- [ ] **Pin `host_permissions`** to the production domain only; the `http://localhost/*` entry is for development and should come out of the shipped build.
- [ ] Budget **days to weeks** for first review. Nothing on the website depends on this shipping — the paste box covers every site on its own.
