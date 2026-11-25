ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS reminder_at timestamptz;
CREATE INDEX IF NOT EXISTS notes_pending_reminder_idx ON public.notes (reminder_at) WHERE reminder_at IS NOT NULL;
