-- An explicit time zone for a role, overriding whatever its city implies.
--
-- Most roles don't need this: the curated city list resolves to an IANA zone
-- on its own. It exists for the case no lookup can infer — a fully remote role
-- with a working-hours requirement ("remote, must overlap with CET") is a real
-- and separate fact from wherever the company happens to be registered.
--
-- Stores an IANA zone id (e.g. "Europe/Vilnius"), never a UTC offset. Offsets
-- move twice a year, and in the weeks when the US and EU disagree about DST a
-- stored number is wrong for everyone.
alter table public.applications
  add column if not exists time_zone text;

-- Loose sanity only. The set of valid zone ids belongs to the IANA database
-- and changes without us; the app validates against the runtime's own list
-- (Intl.supportedValuesOf) and ignores anything it can't resolve.
alter table public.applications
  drop constraint if exists applications_time_zone_check;
alter table public.applications
  add constraint applications_time_zone_check
  check (time_zone is null or (length(time_zone) between 1 and 64));
