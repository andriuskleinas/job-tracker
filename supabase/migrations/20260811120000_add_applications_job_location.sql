-- Capture where a role is based and how it's worked so the board can show it.
--   job_type: how the role is worked — remote, hybrid, or on-site.
--   country/city: where the role is based. Required for on-site and hybrid
--   roles (enforced in the app); optional for fully remote ones, hence nullable.
alter table public.applications
  add column if not exists job_type text,
  add column if not exists country text,
  add column if not exists city text;

-- Keep job_type to the known set; null stays allowed for legacy rows.
alter table public.applications
  drop constraint if exists applications_job_type_check;
alter table public.applications
  add constraint applications_job_type_check
  check (job_type is null or job_type in ('remote', 'hybrid', 'onsite'));
