# Job Tracker

Your whole job search in one place: applications, follow-ups, and interview
momentum, tracked in a dashboard instead of a spreadsheet.

**Live app:** https://job-tracker-rho-khaki-34.vercel.app

Built with [TanStack Start](https://tanstack.com/start) (React + SSR),
[Supabase](https://supabase.com) (Postgres, Auth, RLS), and Tailwind CSS.
Deployed on [Vercel](https://vercel.com).

## Why

Job hunting is a lot of small, easy-to-drop state: which roles are still live,
who owes whom a follow-up, which offer expires when. This is the tracker I
wanted for my own search — one dashboard, one source of truth, with the
tedious parts (capturing a posting, remembering to follow up) automated away.

## Features

- **Pipeline dashboard** — every application's status, priority, and stage in
  one view, with a funnel showing how far the pipeline actually reaches.
- **Follow-up tasks** — due-dated tasks linked to applications, with an
  overdue count that doesn't let a follow-up quietly disappear.
- **Status history** — every stage change is timestamped, so "how long does
  this company take to respond" is a real answer, not a guess.
- **"Clip to Job Tracker" browser extension** — a Chrome extension that reads
  the job ad already rendered in your tab (LinkedIn, Greenhouse, Lever, Ashby,
  Workday, or a generic fallback) and saves salary, requirements, and the full
  text before the posting is taken down. No server-side scraping — it never
  makes a request to the job site itself. See [extension/README.md](extension/README.md).
- **Google Calendar sync** — open, dated tasks push to Google Calendar
  automatically (create/update/delete), or subscribe read-only via a signed
  iCal feed URL from any calendar app. See [docs/google-calendar-sync.md](docs/google-calendar-sync.md).
- **Row-level security by default** — every table is scoped to its owner via
  Postgres RLS; your search is visible to you and nobody else.

## Development

Requires [Bun](https://bun.sh).

```sh
git clone https://github.com/andriuskleinas/job-tracker-web.git
cd job-tracker-web
bun install
bun run dev
```

The dev server runs at http://localhost:8080.

Environment variables (see `.env.example`): the app reads `VITE_SUPABASE_URL`
and `VITE_SUPABASE_PUBLISHABLE_KEY` in the browser, and the non-prefixed
`SUPABASE_*` equivalents during SSR. The Google Calendar integration and
browser extension are optional — see their linked docs above for setup.

## Deployment

Vercel builds from the Build Output API. `bun run build` runs Vite + Nitro's
`vercel` preset, emitting `.vercel/output`, which Vercel deploys directly
(configured in `vercel.json`). Set the `SUPABASE_*` / `VITE_SUPABASE_*`
variables in the Vercel project settings.

## Database

Schema lives in `supabase/migrations/`. Apply changes as new migration files.

## License

[MIT](LICENSE)
