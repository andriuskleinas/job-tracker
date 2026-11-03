-- Which flag-coloured version of the Job Tracker logo a user wants to see
-- (e.g. 'flag:UA', 'pride:rainbow'). Null — the default for everyone — keeps
-- the standard black tile. Ids live in src/lib/logo-theme.ts; the app falls
-- back to the standard logo for any id it doesn't recognise, so the column
-- only guards against junk, not against ids the app hasn't shipped.
ALTER TABLE public.profiles
  ADD COLUMN logo_theme text
    CONSTRAINT profiles_logo_theme_format
      CHECK (logo_theme ~ '^[a-z]+:[A-Za-z0-9-]{1,32}$');
