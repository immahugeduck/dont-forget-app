-- User-customizable categories table
CREATE TABLE IF NOT EXISTS public.user_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#8b5cf6',
  icon TEXT NOT NULL DEFAULT 'folder',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Enable RLS
ALTER TABLE public.user_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "user_categories_select_own" ON public.user_categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_categories_insert_own" ON public.user_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_categories_update_own" ON public.user_categories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_categories_delete_own" ON public.user_categories
  FOR DELETE USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_categories_user ON public.user_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_categories_position ON public.user_categories(user_id, position);
