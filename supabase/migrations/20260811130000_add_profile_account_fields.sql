-- Flesh out the account profile so users can describe themselves and where
-- they're based. All nullable — an existing profile stays valid with these
-- blank, and the app treats every field as optional.
--   first_name / last_name — legal-ish name split.
--   nickname               — what they'd rather be called.
--   country / city         — where they are (free text sourced from a picker).
--   time_zone              — IANA zone id (e.g. "Europe/Vilnius").
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name  text,
  add column if not exists nickname   text,
  add column if not exists country    text,
  add column if not exists city       text,
  add column if not exists time_zone  text;
