-- Why an application was rejected: any number of predefined tags plus an
-- optional free-text note in the user's own words.
--
-- Tags are stored as stable keys ("ghosted", "auto_reply", …), not their
-- display labels, so a label can be reworded in the app without rewriting
-- rows. The set of keys lives in src/lib/rejection.ts; the database only
-- bounds the shape, so adding a tag never needs a migration.
--
-- Both survive a status change away from `rejected` — moving a card out of
-- the archive by mistake should not throw the reason away, and the app only
-- shows it while the status is `rejected`.
--
-- No new policies: the existing own_apps_* policies on public.applications
-- are row-level and already cover these columns.
alter table public.applications
  add column if not exists rejection_reason_tags text[] not null default '{}',
  add column if not exists rejection_note text;

alter table public.applications
  drop constraint if exists applications_rejection_reason_tags_check;
alter table public.applications
  add constraint applications_rejection_reason_tags_check
  check (cardinality(rejection_reason_tags) <= 20);

alter table public.applications
  drop constraint if exists applications_rejection_note_check;
alter table public.applications
  add constraint applications_rejection_note_check
  check (rejection_note is null or length(rejection_note) between 1 and 1000);
