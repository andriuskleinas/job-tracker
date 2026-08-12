-- Google Calendar instant-push sync. Two tables, both SERVICE-ROLE ONLY: they
-- hold OAuth refresh tokens and provider event ids, which must never reach the
-- browser. The client learns connection state through a server endpoint, not a
-- direct query — so `authenticated` gets no grants and RLS has no permissive
-- policies (deny-by-default for everyone but the service role).

-- One Google connection per user.
CREATE TABLE public.google_calendar_connections (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  google_sub TEXT,
  email TEXT,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  access_token TEXT,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,
  scope TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.google_calendar_connections TO service_role;
ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER google_calendar_connections_updated_at
  BEFORE UPDATE ON public.google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Maps a task to the Google event it produced, for updates and deletes.
CREATE TABLE public.task_calendar_events (
  task_id UUID PRIMARY KEY REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google',
  event_id TEXT NOT NULL,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.task_calendar_events TO service_role;
ALTER TABLE public.task_calendar_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER task_calendar_events_updated_at
  BEFORE UPDATE ON public.task_calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX task_calendar_events_user_id_idx ON public.task_calendar_events(user_id);
