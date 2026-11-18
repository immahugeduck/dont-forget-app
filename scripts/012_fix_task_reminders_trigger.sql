-- Root cause of "reminders never fire": a trigger added by hand in the
-- Supabase dashboard,
--   CREATE TRIGGER "Task/reminders" BEFORE INSERT ON public.task_reminders
--   FOR EACH STATEMENT EXECUTE FUNCTION update_updated_at_column();
-- sets NEW.updated_at, but task_reminders has no updated_at column (and a
-- statement-level trigger has no NEW row). Every insert failed with
-- 42703 'record "new" has no field "updated_at"', so no reminder was ever saved.
DROP TRIGGER IF EXISTS "Task/reminders" ON public.task_reminders;
