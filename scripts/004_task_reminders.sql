-- Task reminders table for scheduled notifications per checklist item
create table if not exists public.task_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  reminder_datetime timestamp with time zone not null,
  sent boolean default false,
  created_at timestamp with time zone default now(),
  unique(checklist_id)  -- One reminder per task
);

-- Enable RLS on task_reminders
alter table public.task_reminders enable row level security;

-- RLS policies for task_reminders
create policy "task_reminders_select_own" on public.task_reminders
  for select using (auth.uid() = user_id);

create policy "task_reminders_insert_own" on public.task_reminders
  for insert with check (auth.uid() = user_id);

create policy "task_reminders_update_own" on public.task_reminders
  for update using (auth.uid() = user_id);

create policy "task_reminders_delete_own" on public.task_reminders
  for delete using (auth.uid() = user_id);

-- Index for faster queries on pending reminders
create index if not exists idx_task_reminders_pending on public.task_reminders(reminder_datetime, sent)
  where sent = false;
create index if not exists idx_task_reminders_user on public.task_reminders(user_id);
