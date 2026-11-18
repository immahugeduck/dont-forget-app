-- On-time reminders: Supabase pg_cron calls the app's sender every minute
-- (Vercel Hobby crons run once a day and GitHub Actions schedules drift by
-- 10-40 minutes). The call is skipped when nothing is due, so the app is only
-- woken when a reminder or daily nudge actually needs to go out.
--
-- Auth: a random secret generated here, kept in Supabase Vault. The app reads
-- it from vault.decrypted_secrets to check the Authorization header, so it is
-- never copied anywhere else. Rotate: update the vault secret; no redeploy.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT vault.create_secret(
  encode(extensions.gen_random_bytes(32), 'hex'),
  'reminder_tick_secret',
  'Don''t Forget: pg_cron -> /api/notifications/send bearer token'
)
WHERE NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'reminder_tick_secret');

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

-- True when a task reminder or a daily nudge is due now.
CREATE OR REPLACE FUNCTION private.dontforget_work_due() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN EXISTS (
      SELECT 1 FROM public.task_reminders r
      WHERE r.sent = false AND r.reminder_datetime <= now() + interval '30 seconds'
    ) OR EXISTS (
      SELECT 1 FROM public.push_subscriptions p
      WHERE p.enabled
        AND to_char(now() AT TIME ZONE coalesce(p.timezone, 'UTC'), 'HH24:MI') >= p.reminder_time
        AND (p.last_sent_on IS NULL OR p.last_sent_on < (now() AT TIME ZONE coalesce(p.timezone, 'UTC'))::date)
    ) OR EXISTS (
      SELECT 1 FROM public.push_subscriptions t
      WHERE t.test_at IS NOT NULL AND t.test_at <= now() + interval '30 seconds'
    ) OR EXISTS (
      SELECT 1 FROM public.device_tokens d
      WHERE d.enabled
        AND to_char(now() AT TIME ZONE 'UTC', 'HH24:MI') >= d.reminder_time
        AND (d.last_sent_on IS NULL OR d.last_sent_on < (now() AT TIME ZONE 'UTC')::date)
    );
EXCEPTION WHEN OTHERS THEN
  -- e.g. a time zone name Postgres doesn't know: let the app decide.
  RETURN true;
END $$;

-- Calls the sender if there's work. Returns the pg_net request id (or null).
CREATE OR REPLACE FUNCTION private.dontforget_reminder_tick() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  secret text;
  url text := coalesce(
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'reminder_tick_url'),
    'https://dont-forget-app-nine.vercel.app/api/notifications/send'
  );
BEGIN
  IF NOT private.dontforget_work_due() THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name = 'reminder_tick_secret';
  IF secret IS NULL THEN RETURN NULL; END IF;
  RETURN net.http_get(
    url := url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret),
    timeout_milliseconds := 55000
  );
END $$;

REVOKE ALL ON FUNCTION private.dontforget_work_due() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.dontforget_reminder_tick() FROM PUBLIC, anon, authenticated;

-- Every minute (pg_cron runs at second 0). Re-running this file is safe.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'dontforget-reminders';
SELECT cron.schedule('dontforget-reminders', '* * * * *', 'SELECT private.dontforget_reminder_tick()');
