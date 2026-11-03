-- How many applications a user means to send per day, for the consistency
-- tracker beside the applications board. Every account starts at 2 so the
-- tracker has something to measure against before anyone opens its settings.
ALTER TABLE public.profiles
  ADD COLUMN daily_application_goal smallint NOT NULL DEFAULT 2
    CONSTRAINT profiles_daily_application_goal_range
      CHECK (daily_application_goal BETWEEN 1 AND 50);
