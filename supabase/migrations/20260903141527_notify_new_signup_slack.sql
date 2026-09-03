-- Notify Slack (#job-tracker-registrations) when a user's email is confirmed.
-- Covers both signup paths: auto-confirmed at insert (no confirmation flow),
-- and confirmed later via the email link (OLD -> NEW transition on update).
-- The webhook URL lives in Supabase Vault (`slack_signup_webhook_url`), never
-- in a migration file, since this repo is public.
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_new_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  webhook_url text;
BEGIN
  SELECT decrypted_secret INTO webhook_url
  FROM vault.decrypted_secrets
  WHERE name = 'slack_signup_webhook_url'
  LIMIT 1;

  IF webhook_url IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := webhook_url,
    body := jsonb_build_object(
      'text', format('New Job Tracker signup: %s', NEW.email)
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_new_signup() FROM PUBLIC, anon, authenticated;

-- Case 1: email confirmation is disabled, so the row is already confirmed
-- the moment it's inserted.
CREATE TRIGGER on_auth_user_created_confirmed
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.notify_new_signup();

-- Case 2: email confirmation is required, so the row starts unconfirmed and
-- is updated once the user clicks the link.
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.notify_new_signup();
