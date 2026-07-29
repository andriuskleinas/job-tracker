## Smoke Test Plan

Drive the live preview with Playwright (headless Chromium) to verify auth, CRUD, and per-user isolation. Capture screenshots at each step for evidence.

### 1. Auth flow (User A)
- Navigate to `/auth`, sign up with `usera+<ts>@test.dev` / password.
- Verify redirect to `/applications` and Navbar shows signed-in state.
- Sign out via Navbar; verify redirect and session cleared (localStorage `sb-*-auth-token` gone).
- Sign back in with same creds; verify session restored.

### 2. Applications CRUD (User A)
- **Create**: open "New application" dialog, submit (Acme / Engineer / applied / today / note). Verify card appears in list.
- **Read**: click card → `/applications/$id` renders the record.
- **Update**: edit status to `interviewing` and change notes; verify persisted after reload.
- **Delete**: delete the application; verify it disappears from list and DB (via psql if `PGHOST` available).

### 3. Tasks CRUD (User A)
- On an application detail page, add a task with due date.
- Verify it appears on `/tasks` global view.
- Toggle done; edit title; delete. Verify each op via UI + reload.

### 4. Per-user isolation (User B)
- Sign out User A. Sign up User B (`userb+<ts>@test.dev`).
- Verify `/applications` list is empty (does not show A's data).
- Verify `/tasks` empty.
- Attempt direct access to User A's application URL `/applications/<A-id>` — expect not-found / empty (RLS blocks the row).
- Direct Supabase probe as User B: `supabase.from('applications').select('*')` returns only B's rows; attempted insert with `user_id = A.id` fails RLS.

### 5. Reporting
- Report per-step: pass/fail, final URL, screenshot path, any console errors or network 4xx/5xx.
- If a step fails, capture the failing request payload/response and stop before mutating further.

### Technical notes
- Script under `/tmp/browser/smoke/`, viewport 1280x1800, `headless=True`.
- Two isolated browser contexts (one per user) so sessions don't bleed.
- Preserve one User A application ID across contexts to test cross-user access.
- No code changes; read-only verification of the running preview at `http://localhost:8080`.
