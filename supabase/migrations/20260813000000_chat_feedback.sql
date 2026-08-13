-- Create chat_feedback table to store user ratings and comments on AI responses
create table if not exists public.chat_feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.chat_messages(id) on delete cascade not null,
  is_positive boolean not null,
  feedback_text text,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint chat_feedback_message_id_key unique (message_id)
);

-- Enable Row Level Security (RLS)
alter table public.chat_feedback enable row level security;

-- Drop existing policies if any
drop policy if exists "Allow users to manage feedback in their conversations" on public.chat_feedback;
drop policy if exists "Allow users to manage feedback for their messages" on public.chat_feedback;

-- RLS Policy for chat_feedback
create policy "Allow users to manage feedback for their messages"
  on public.chat_feedback for all
  to authenticated
  using (
    exists (
      select 1 from public.chat_messages m
      join public.chat_conversations c on m.conversation_id = c.id
      where m.id = chat_feedback.message_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.chat_messages m
      join public.chat_conversations c on m.conversation_id = c.id
      where m.id = chat_feedback.message_id
        and c.user_id = auth.uid()
    )
  );

-- Create index for fast lookup
create index if not exists chat_feedback_message_id_idx on public.chat_feedback(message_id);
