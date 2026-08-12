-- Optional time-of-day and duration for a task. With just a due_date a task
-- syncs to the calendar as an all-day event (unchanged); adding a due_time makes
-- it a timed event lasting duration_minutes (defaulting to 30 in app code when a
-- time is set but no duration chosen). Both nullable so every existing task stays
-- valid and all-day.
alter table public.tasks
  add column due_time time,
  add column duration_minutes integer;
