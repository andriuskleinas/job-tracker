# Google Calendar sync — setup

Connecting Google Calendar lets the app push every open, dated task to the user's
calendar automatically (create → event added, edit → event updated, complete or
delete → event removed). This is one-way (app → Google); calendar edits are not
read back. Tasks without a due date never become events.

Three one-time setup steps are required before it works: a Google OAuth app, some
env vars, and one database migration.

## 1. Google Cloud OAuth app

1. In [Google Cloud Console](https://console.cloud.google.com/), create (or pick) a
   project and **enable the Google Calendar API** (APIs & Services → Library).
2. **OAuth consent screen**: user type External. Add the scopes `openid`, `email`,
   and `https://www.googleapis.com/auth/calendar.events`.
   - Set **Publishing status → In production**. (Leaving it in *Testing* makes Google
     expire refresh tokens after 7 days, forcing a weekly reconnect. Production works
     even while "unverified" — users just click through a one-time warning screen.)
3. **Credentials → Create credentials → OAuth client ID → Web application**. Add
   **Authorized redirect URIs**:
   - `http://localhost:8080/calendar/google/callback` (local dev)
   - `https://<your-prod-domain>/calendar/google/callback` (production)
4. Copy the **Client ID** and **Client secret**.

## 2. Environment variables

Set these in local `.env` **and** in the Vercel project (Production + Preview):

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | OAuth client id from step 1 |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret from step 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | Already required by the app; reads/writes the token tables and signs the OAuth `state`. Must be present. |
| `CALENDAR_FEED_SECRET` | *Optional.* If unset, the service-role key is used to sign OAuth `state`/feed tokens. |

## 3. Database migration

Apply `supabase/migrations/20260812090000_google_calendar_sync.sql` in the Supabase
SQL editor (this project applies migrations manually). It creates two
**service-role-only** tables — `google_calendar_connections` and
`task_calendar_events` — so OAuth refresh tokens and event ids never reach the
browser. Verify afterwards:

```sql
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('google_calendar_connections', 'task_calendar_events');
```

## Using it

Tasks page → **Calendar sync** → **Connect Google Calendar** → grant access → you're
returned to the Tasks page with a confirmation. Existing open, dated tasks are
backfilled on connect. **Disconnect** from the same dialog revokes access and stops
syncing (it leaves any already-created events in place).

## How it works (for maintainers)

- Endpoints live in `src/lib/google-calendar.server.ts`, routed ahead of the app in
  `src/server.ts` under `/calendar/google/*`. Bearer-authed endpoints reuse
  `src/lib/server-auth.server.ts`; the OAuth `state` is HMAC-signed with a 10-minute
  TTL.
- On any task create/update/delete, the client calls `syncTaskCalendar()`
  (`src/lib/calendar-sync.ts`) → `POST /calendar/google/sync` → `reconcileTask()`,
  which makes Google match the task's current state. It's best-effort: a sync failure
  never blocks task CRUD, and is a no-op when the user hasn't connected.
- Event shape (title, description, all-day start/end) comes from the shared
  `src/lib/task-event.ts`, so the Google push and the iCal feed describe tasks
  identically.

## Not included

- Outlook / Apple push (the iCal feed from the earlier phase still covers those if
  re-exposed in the UI).
- Reading Google-side edits back into tasks.
- Encryption-at-rest for refresh tokens (they sit in a service-role-only table;
  pgsodium/Vault would be a further hardening).
