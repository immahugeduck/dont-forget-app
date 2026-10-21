-- Daily reminders: remember the UTC day each subscription was last sent, so
-- the send job can run every 15 minutes and still send once per day.
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS last_sent_on date;
ALTER TABLE public.device_tokens ADD COLUMN IF NOT EXISTS last_sent_on date;

-- Notes written before categories existed are keyed by a bare date
-- (YYYY-MM-DD), which the planner never shows. Move them into the
-- "personal" category (key YYYY-MM-DD-personal) unless that day already has
-- a personal note.
UPDATE public.notes n
SET date = n.date || '-personal', updated_at = now()
WHERE n.date ~ '^\d{4}-\d{2}-\d{2}$'
  AND NOT EXISTS (
    SELECT 1 FROM public.notes p
    WHERE p.user_id = n.user_id AND p.date = n.date || '-personal'
  );
