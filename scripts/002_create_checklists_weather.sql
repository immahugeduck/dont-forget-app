-- Checklists table for task items
create table if not exists public.checklists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  slot_id text not null,
  category text not null,
  text text not null,
  completed boolean default false,
  position integer not null default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Weather cache table
create table if not exists public.weather_cache (
  id uuid primary key default gen_random_uuid(),
  date text not null unique,
  temp_high integer,
  temp_low integer,
  conditions text[] default '{}',
  icon text,
  fetched_at timestamp with time zone default now()
);

-- Enable RLS on checklists
alter table public.checklists enable row level security;

-- RLS policies for checklists
create policy "checklists_select_own" on public.checklists
  for select using (auth.uid() = user_id);

create policy "checklists_insert_own" on public.checklists
  for insert with check (auth.uid() = user_id);

create policy "checklists_update_own" on public.checklists
  for update using (auth.uid() = user_id);

create policy "checklists_delete_own" on public.checklists
  for delete using (auth.uid() = user_id);

-- Weather cache is public read (no user auth needed)
-- but we'll manage writes from server only
alter table public.weather_cache enable row level security;

create policy "weather_select_all" on public.weather_cache
  for select using (true);

-- Index for faster checklist queries
create index if not exists idx_checklists_user_date on public.checklists(user_id, date, category);
create index if not exists idx_weather_date on public.weather_cache(date);
