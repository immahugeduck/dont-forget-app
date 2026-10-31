-- An older version of the editor saved on every keystroke, and the save
-- endpoint's check-then-insert let quick saves each insert a new row, leaving
-- several notes for the same (user, day). Keep the newest one per key, then
-- add a unique index so it can't happen again.
DELETE FROM public.notes n
USING public.notes newer
WHERE n.user_id = newer.user_id
  AND n.date = newer.date
  AND (newer.created_at, newer.id) > (n.created_at, n.id);

CREATE UNIQUE INDEX IF NOT EXISTS notes_user_id_date_key ON public.notes (user_id, date);
