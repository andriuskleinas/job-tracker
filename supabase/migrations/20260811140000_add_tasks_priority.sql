-- Priority flag for follow-up tasks: a simple High/Normal signal so a task
-- that matters (interview prep for a dream role) can outrank routine
-- follow-ups. Boolean maps to the star toggle in the UI; defaults to false so
-- every existing task stays "normal" priority.
alter table public.tasks
  add column priority boolean not null default false;
