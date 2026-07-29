-- Records every application status transition.
--
-- `applications.status` is a single mutable column, so today the database can
-- only ever answer "where is this application now" — an application that
-- interviewed and was then rejected reports only `rejected`. This table starts
-- accumulating the history needed for a true funnel, time-in-stage, and
-- conversion trends. Recording is cheap now; history not recorded cannot be
-- recovered later.
--
-- `applications` remains the source of truth for current status; this table is
-- append-only and derived.

CREATE TABLE public.application_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  status public.application_status NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Read-only to users: rows are written exclusively by the trigger below, so no
-- INSERT/UPDATE/DELETE grant is issued and the log cannot be forged or rewritten.
GRANT SELECT ON public.application_status_events TO authenticated;
GRANT ALL ON public.application_status_events TO service_role;
ALTER TABLE public.application_status_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_status_events_select" ON public.application_status_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.id = application_status_events.application_id AND a.user_id = auth.uid()
  ));

CREATE INDEX application_status_events_application_idx
  ON public.application_status_events(application_id, changed_at);

CREATE OR REPLACE FUNCTION public.log_application_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.application_status_events (application_id, status, changed_at)
    VALUES (NEW.id, NEW.status, NEW.created_at);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    -- The app submits the whole form on save, so `UPDATE OF status` fires even
    -- when the value is unchanged; this guard keeps the log free of no-ops.
    INSERT INTO public.application_status_events (application_id, status, changed_at)
    VALUES (NEW.id, NEW.status, now());
  END IF;
  RETURN NULL;
END; $$;

REVOKE ALL ON FUNCTION public.log_application_status_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER applications_log_status_insert
  AFTER INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.log_application_status_change();

CREATE TRIGGER applications_log_status_update
  AFTER UPDATE OF status ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.log_application_status_change();

-- Backfill only what is genuinely known: every existing application did begin
-- as 'applied' on its application_date. Intermediate transitions were never
-- recorded and are deliberately NOT synthesised — inventing timestamps would
-- make the history look complete when it is not. Treat any application whose
-- current status differs from its logged events as "history starts here".
INSERT INTO public.application_status_events (application_id, status, changed_at)
SELECT id, 'applied'::public.application_status, application_date::TIMESTAMPTZ
FROM public.applications;
