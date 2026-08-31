-- Keep the job ad itself, because the posting is deleted long before the
-- interview. By then the user needs two things they can no longer look up:
-- what the role paid, and what it asked for.
--
--   job_url         the ad. `website` stays the *company* site (it feeds the
--                   board logo and nothing else), so these never collide.
--   description     the ad body as captured — the archival copy.
--   requirements    the must-haves, split out of the body for interview prep.
--                   Deliberately a copy of a slice of `description`, so the
--                   description stays whole and faithful.
--   salary_*        the band, as five columns rather than one string, so the
--                   board can filter, sort and chart on it. `salary_source`
--                   records where the number came from — at offer time, a
--                   posted band and a recruiter's aside are not the same fact.
--   captured_at     when the ad was saved, so the UI can say "captured 12 Aug"
--                   and the user knows how much to trust it.
--
-- All nullable and additive: every existing row stays valid. No new table, so
-- the existing own_apps_* policies on public.applications already cover these.
alter table public.applications
  add column if not exists job_url         text,
  add column if not exists description     text,
  add column if not exists requirements    text,
  add column if not exists salary_min      numeric(12, 2),
  add column if not exists salary_max      numeric(12, 2),
  add column if not exists salary_currency text,
  add column if not exists salary_period   text,
  add column if not exists salary_source   text,
  add column if not exists captured_at     timestamptz;

-- Keep the enum-ish columns to their known sets; null stays allowed throughout
-- so legacy rows and partial captures are both valid.
alter table public.applications
  drop constraint if exists applications_salary_period_check;
alter table public.applications
  add constraint applications_salary_period_check
  check (
    salary_period is null
    or salary_period in ('year', 'month', 'week', 'day', 'hour')
  );

alter table public.applications
  drop constraint if exists applications_salary_source_check;
alter table public.applications
  add constraint applications_salary_source_check
  check (
    salary_source is null
    or salary_source in ('posted', 'recruiter', 'estimate')
  );

-- ISO 4217, uppercase. Without it a cross-border pipeline compares 70,000 of
-- nothing against 70,000 of something else.
alter table public.applications
  drop constraint if exists applications_salary_currency_check;
alter table public.applications
  add constraint applications_salary_currency_check
  check (salary_currency is null or salary_currency ~ '^[A-Z]{3}$');

-- A band that runs backwards is a data-entry slip, not a salary.
alter table public.applications
  drop constraint if exists applications_salary_range_check;
alter table public.applications
  add constraint applications_salary_range_check
  check (
    salary_min is null
    or salary_max is null
    or salary_min <= salary_max
  );
