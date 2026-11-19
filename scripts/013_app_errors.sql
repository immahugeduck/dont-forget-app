-- Lightweight error log so failures that users never see (failed saves,
-- reminder scheduling, push delivery, email sends) are visible to the owner.
-- Written only by the server (postgres role); RLS with no policies blocks the
-- public API. Old rows are pruned daily by pg_cron.
CREATE TABLE IF NOT EXISTS public.app_errors (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  origin text NOT NULL DEFAULT 'server' CHECK (origin IN ('server', 'client')),
  source text NOT NULL,
  message text NOT NULL,
  stack text,
  context jsonb,
  user_id uuid
);
CREATE INDEX IF NOT EXISTS app_errors_created_at_idx ON public.app_errors (created_at DESC);
ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_errors FROM anon, authenticated;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'dontforget-prune-errors';
SELECT cron.schedule('dontforget-prune-errors', '17 4 * * *', $$DELETE FROM public.app_errors WHERE created_at < now() - interval '30 days'$$);
