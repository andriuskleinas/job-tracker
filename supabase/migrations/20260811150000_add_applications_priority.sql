-- Priority flag for a job opportunity itself (not just its follow-up tasks):
-- a simple High/Normal star so a dream-role application can be pinned to the
-- top of the board. Boolean maps to the star toggle in the UI; defaults to
-- false so every existing application stays "normal" priority.
alter table public.applications
  add column priority boolean not null default false;
