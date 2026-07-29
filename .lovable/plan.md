## Job Tracker — Plan

### Fix build blocker first
- Install missing `@supabase/supabase-js` package (TS build currently fails on all three integration files).

### Database (one migration)
- `profiles` — `id` (PK → auth.users), `display_name`, `email`, timestamps. Auto-created via `handle_new_user` trigger on `auth.users`.
- `applications` — `user_id`, `company`, `position`, `status` (enum: applied/interviewing/offer/rejected/withdrawn), `application_date`, `notes`, timestamps.
- `tasks` — `application_id` (FK → applications, ON DELETE CASCADE), `title`, `due_date`, `done`, timestamps. No `user_id` column; ownership derived from parent application.
- RLS on all three, scoped to `auth.uid()`. Task policies use `EXISTS (SELECT 1 FROM applications WHERE id = tasks.application_id AND user_id = auth.uid())`.
- GRANTs to `authenticated` + `service_role` (no anon).
- `updated_at` trigger.

### Routes
- `/` — landing; if signed in, link/redirect to `/applications`; if not, sign-in CTA.
- `/auth` — email/password sign in + sign up (public).
- `/_authenticated/applications` — list + create form.
- `/_authenticated/applications/$id` — detail, edit, delete + nested Tasks CRUD for that application.
- `/_authenticated/tasks` — flat list of all the user's tasks across applications, with toggle-done.

Uses the integration-managed `_authenticated/route.tsx` gate (do not author).

### UI
- Shared navbar in `__root.tsx` with Applications / Tasks links + session-aware Sign in / Sign out (per auth-guards rules).
- shadcn components, light modern theme via existing tokens (no hardcoded colors).
- Forms: `react-hook-form` + `zod` + shadcn Form; `sonner` toasts for success/error.
- Per-route `head()` metadata (title/description/og).

### Data layer
- Browser `supabase` client for all reads/writes (RLS enforces isolation — no server functions needed for this scope).
- TanStack Query for fetching/caching + mutations with `invalidateQueries`.
- Root `onAuthStateChange` listener → `router.invalidate()` + query invalidation (filtered per docs).
- Sign-out follows the 4-step hygiene (cancel → clear → signOut → navigate replace).

### Acceptance mapping
- A1: `/auth` handles sign up / in; navbar Sign out.
- A2/A3: inserts set `user_id = auth.uid()`; RLS filters lists to owner.
- A4: user publishes via Lovable Publish after review.

### Out of scope
- Password reset page, social login, profile editing UI, file uploads, analytics.