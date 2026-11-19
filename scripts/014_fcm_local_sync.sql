-- FCM + on-device alarms without double notifications.
-- The Android app reports when it last scheduled its local alarms; the server
-- only pushes reminders created/changed after that (e.g. added on the web).
ALTER TABLE public.device_tokens
  ADD COLUMN IF NOT EXISTS local_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS local_covered_until timestamptz;

ALTER TABLE public.task_reminders
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
UPDATE public.task_reminders SET updated_at = created_at;

CREATE OR REPLACE FUNCTION public.task_reminders_touch() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.reminder_datetime IS DISTINCT FROM OLD.reminder_datetime
     OR NEW.checklist_id IS DISTINCT FROM OLD.checklist_id THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS task_reminders_touch ON public.task_reminders;
CREATE TRIGGER task_reminders_touch BEFORE UPDATE ON public.task_reminders
  FOR EACH ROW EXECUTE FUNCTION public.task_reminders_touch();
