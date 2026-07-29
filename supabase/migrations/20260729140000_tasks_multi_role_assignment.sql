-- Decouple tasks from a single application: a task can now be assigned to
-- any number of roles (applications), including zero.

ALTER TABLE public.tasks ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.tasks t SET user_id = a.user_id FROM public.applications a WHERE a.id = t.application_id;
ALTER TABLE public.tasks ALTER COLUMN user_id SET NOT NULL;

DROP POLICY "tasks_select" ON public.tasks;
DROP POLICY "tasks_insert" ON public.tasks;
DROP POLICY "tasks_update" ON public.tasks;
DROP POLICY "tasks_delete" ON public.tasks;

CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX tasks_user_id_idx ON public.tasks(user_id);

-- Junction table: many-to-many between tasks and applications (roles).
CREATE TABLE public.task_applications (
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, application_id)
);
GRANT SELECT, INSERT, DELETE ON public.task_applications TO authenticated;
GRANT ALL ON public.task_applications TO service_role;
ALTER TABLE public.task_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_applications_select" ON public.task_applications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_applications.task_id AND t.user_id = auth.uid()));
CREATE POLICY "task_applications_insert" ON public.task_applications FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_applications.task_id AND t.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.applications a WHERE a.id = task_applications.application_id AND a.user_id = auth.uid())
  );
CREATE POLICY "task_applications_delete" ON public.task_applications FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_applications.task_id AND t.user_id = auth.uid()));

CREATE INDEX task_applications_application_idx ON public.task_applications(application_id);

-- Backfill the junction table from the existing 1:1 relationship, then drop the old column.
INSERT INTO public.task_applications (task_id, application_id)
SELECT id, application_id FROM public.tasks WHERE application_id IS NOT NULL;

DROP INDEX IF EXISTS public.tasks_application_id_idx;
ALTER TABLE public.tasks DROP COLUMN application_id;
