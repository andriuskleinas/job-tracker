# Job Tracker

Track job applications and follow-up tasks in one clean dashboard.

Built with [TanStack Start](https://tanstack.com/start) (React + SSR),
[Supabase](https://supabase.com) (Postgres, Auth, RLS), and Tailwind CSS.
Deployed on [Vercel](https://vercel.com).

## Development

Requires [Bun](https://bun.sh).

```sh
git clone <this-repository-url>
cd smart-project-planner
bun install
bun run dev
```

The dev server runs at http://localhost:8080.

Environment variables (see `.env`): the app reads `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` in the browser, and the non-prefixed
`SUPABASE_*` equivalents during SSR.

## Deployment

Vercel builds from the Build Output API. `bun run build` runs Vite + Nitro's
`vercel` preset, emitting `.vercel/output`, which Vercel deploys directly
(configured in `vercel.json`). Set the `SUPABASE_*` / `VITE_SUPABASE_*`
variables in the Vercel project settings.

## Database

Schema lives in `supabase/migrations/`. Apply changes as new migration files.
