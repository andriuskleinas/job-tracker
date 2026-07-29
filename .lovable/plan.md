## Hardening Plan

Small, low-risk hygiene improvements. No functional changes to the app.

### 1. Git hygiene
- Add `.env`, `.env.local`, `.env.*.local` to `.gitignore` so future secrets can't be accidentally committed. (Current `.env` only holds the public anon key + URL, so no rotation needed.)

### 2. Auth hardening (Supabase dashboard — user action)
- Enable **Leaked Password Protection** (HaveIBeenPwned) under Auth → Providers → Email.
- Keep **Confirm email** ON in production (currently causing rate-limit hits during smoke tests — only disable for dev).
- Set a minimum password length of 8+ in Auth settings.

### 3. Client-side input validation
- Add `zod` schemas for the Auth form (email format, password length ≥ 8) and Application/Task forms (trim, max length on `company`, `position`, `notes`, task `title`) with inline error messages. RLS already protects the DB; this improves UX and blocks obvious junk.

### 4. Security headers on the root document
- Add basic meta/response hardening in `src/routes/__root.tsx` head: `referrer` = `strict-origin-when-cross-origin`, and a minimal `Content-Security-Policy` compatible with Supabase + Vite.

### 5. Session/auth hygiene review (code)
- Confirm sign-out flow: `queryClient.cancelQueries` → `clear()` → `supabase.auth.signOut()` → navigate (already implemented — verify).
- Ensure no `SUPABASE_SERVICE_ROLE_KEY` import path is reachable from client bundles (verify `client.server.ts` is only imported from server functions).

### 6. Re-run security scan
- After the above, re-run `security--run_security_scan` to confirm no new findings.

### Out of scope (explicitly not doing)
- Rotating the anon key (it's public by design).
- Rewriting RLS (already correct and verified).
- Adding rate limiting (no primitive available on this stack).

Confirm and I'll implement steps 1, 3, 4, 5, 6. Steps in section 2 require you to toggle settings in the Supabase dashboard.
