-- Task reminders can follow the task's due time automatically ("due") or be a
-- custom time the user picked ("manual"). Existing rows are custom.
ALTER TABLE public.task_reminders ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.task_reminders DROP CONSTRAINT IF EXISTS task_reminders_source_check;
ALTER TABLE public.task_reminders ADD CONSTRAINT task_reminders_source_check CHECK (source IN ('due', 'manual'));

-- "Send a test in 1 minute": the next scheduler tick at or after test_at sends
-- a test push to this subscription, proving the whole scheduled path works.
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS test_at timestamptz;
