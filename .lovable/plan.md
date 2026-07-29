## CSV import for Applications

Add an "Import CSV" button on `/applications` next to "New application" that opens a dialog letting users upload a `.csv` file, previews parsed rows, imports valid ones, and reports errors.

### CSV format
Header row required. Columns: `company`, `position`, `status`, `application_date`, `notes`.
- `company`, `position`: required, 1–120 chars.
- `status`: one of `applied|interviewing|offer|rejected|withdrawn`. Defaults to `applied` if empty.
- `application_date`: `YYYY-MM-DD`. Defaults to today if empty.
- `notes`: optional, ≤2000 chars.

### Behavior
- Parse client-side with PapaParse (`papaparse`), `header: true`, `skipEmptyLines: true`.
- Validate each row with the existing zod `appSchema` (extended to accept the defaults above).
- Import **all valid rows** (no dedupe) via a single `supabase.from("applications").insert([...])` scoped to the current `user_id`.
- Show a summary toast: `Imported X, skipped Y`, and render a per-row error list (row number + reason) inside the dialog when any fail.
- Invalidate the `["applications"]` query on success.
- Provide a "Download template" link that generates a small sample CSV.

### Files
- `package.json`: add `papaparse` + `@types/papaparse`.
- `src/routes/_authenticated/applications.index.tsx`: add Import button, dialog, parse/validate/insert logic, template download.

### Out of scope
No backend/schema changes. No server function — RLS on `applications` already enforces per-user access on the client insert.
