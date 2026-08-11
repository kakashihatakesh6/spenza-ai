-- 1. Drop chat_feedback table
drop table if exists public.chat_feedback cascade;

-- 2. Create user_notifications table
create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  message text not null,
  type text not null default 'info',
  category_name text not null default 'ALERT',
  read boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.user_notifications enable row level security;

-- RLS Policy for user_notifications
create policy "Allow users to manage their own notifications"
  on public.user_notifications for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
