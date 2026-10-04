-- Keep-alive heartbeat for the free-tier Supabase auto-pause workaround.
--
-- Supabase pauses free projects after ~7 days without database activity,
-- and its docs don't guarantee that a read resets that timer. This adds a
-- real write path instead: a single-row table touched through an RPC by
-- the scheduled GitHub Action (.github/workflows/supabase-keepalive.yml).
CREATE TABLE public.keepalive_ping (
  id smallint PRIMARY KEY DEFAULT 1,
  pinged_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT keepalive_ping_single_row CHECK (id = 1)
);

INSERT INTO public.keepalive_ping (id) VALUES (1);

-- No direct client access: RLS enabled with no policies. The only write
-- path is record_keepalive_ping(), which can do nothing but bump the
-- timestamp on the one row.
ALTER TABLE public.keepalive_ping ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.record_keepalive_ping()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.keepalive_ping SET pinged_at = now() WHERE id = 1;
$$;

REVOKE ALL ON FUNCTION public.record_keepalive_ping() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_keepalive_ping() TO anon;
