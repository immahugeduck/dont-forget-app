-- Daily reminders follow each device's own time zone (and daylight saving)
-- instead of a fixed UTC time. Null means reminder_time is in UTC (older rows);
-- the app fills it in the next time it's opened.
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS timezone text;
