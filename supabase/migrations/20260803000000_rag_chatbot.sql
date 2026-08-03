-- Enable pgvector extension
create extension if not exists vector;

-- 1. documents table
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  filename text not null,
  storage_path text not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  file_type text not null,
  version integer not null default 1,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. document_chunks table
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete cascade not null,
  chunk_text text not null,
  embedding vector(768) not null, -- Gemini text-embedding-004 has 768 dimensions
  page_number integer,
  section text,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. chat_conversations table
create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default 'New Conversation',
  summary text, -- stored conversation summary to limit context window
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. chat_messages table
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.chat_conversations(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  citations jsonb default '[]'::jsonb not null, -- citation metadata (filename, page, etc.)
  token_usage jsonb default '{}'::jsonb not null, -- { prompt_tokens, completion_tokens, total_tokens }
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. chat_feedback table
create table if not exists public.chat_feedback (
  message_id uuid primary key references public.chat_messages(id) on delete cascade,
  is_positive boolean not null,
  feedback_text text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_feedback enable row level security;

-- RLS Policies for documents
create policy "Allow users to view their own documents or global ones"
  on public.documents for select
  to authenticated
  using (uploaded_by = auth.uid() or uploaded_by is null);

create policy "Allow users to insert their own documents"
  on public.documents for insert
  to authenticated
  with check (uploaded_by = auth.uid());

create policy "Allow users to delete their own documents"
  on public.documents for delete
  to authenticated
  using (uploaded_by = auth.uid());

-- RLS Policies for document_chunks (read-only for users who have access to parent doc)
create policy "Allow users to view chunks from readable documents"
  on public.document_chunks for select
  to authenticated
  using (
    exists (
      select 1 from public.documents
      where documents.id = document_chunks.document_id
        and (documents.uploaded_by = auth.uid() or documents.uploaded_by is null)
    )
  );

-- RLS Policies for chat_conversations
create policy "Allow users to manage their own conversations"
  on public.chat_conversations for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- RLS Policies for chat_messages
create policy "Allow users to manage messages in their conversations"
  on public.chat_messages for all
  to authenticated
  using (
    exists (
      select 1 from public.chat_conversations
      where chat_conversations.id = chat_messages.conversation_id
        and chat_conversations.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.chat_conversations
      where chat_conversations.id = chat_messages.conversation_id
        and chat_conversations.user_id = auth.uid()
    )
  );

-- RLS Policies for chat_feedback
create policy "Allow users to manage feedback in their conversations"
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

-- Vector Similarity Search Stored Function
create or replace function public.match_document_chunks(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_uploaded_by uuid default null,
  filter_document_ids uuid[] default null
)
returns table (
  chunk_id uuid,
  document_id uuid,
  chunk_text text,
  similarity float,
  page_number int,
  section text,
  metadata jsonb,
  document_title text,
  document_filename text
)
language plpgsql
as $$
begin
  return query
  select
    c.id as chunk_id,
    c.document_id,
    c.chunk_text,
    1 - (c.embedding <=> query_embedding) as similarity,
    c.page_number,
    c.section,
    c.metadata,
    d.title as document_title,
    d.filename as document_filename
  from public.document_chunks c
  join public.documents d on c.document_id = d.id
  where (1 - (c.embedding <=> query_embedding)) > match_threshold
    and (filter_uploaded_by is null or d.uploaded_by = filter_uploaded_by or d.uploaded_by is null)
    and (filter_document_ids is null or c.document_id = any(filter_document_ids))
  order by c.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Hybrid Search Stored Function (Vector similarity + Keyword match)
create or replace function public.match_document_chunks_hybrid(
  query_text text,
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_uploaded_by uuid default null,
  filter_document_ids uuid[] default null,
  full_text_weight float default 0.4,
  vector_weight float default 0.6
)
returns table (
  chunk_id uuid,
  document_id uuid,
  chunk_text text,
  similarity float,
  page_number int,
  section text,
  metadata jsonb,
  document_title text,
  document_filename text
)
language plpgsql
as $$
begin
  return query
  with vector_search as (
    select
      c.id as cid,
      1 - (c.embedding <=> query_embedding) as sim_score
    from public.document_chunks c
    join public.documents d on c.document_id = d.id
    where (filter_uploaded_by is null or d.uploaded_by = filter_uploaded_by or d.uploaded_by is null)
      and (filter_document_ids is null or c.document_id = any(filter_document_ids))
  ),
  keyword_search as (
    select
      c.id as cid,
      ts_rank_cd(to_tsvector('english', c.chunk_text), plainto_tsquery('english', query_text)) as fts_score
    from public.document_chunks c
    join public.documents d on c.document_id = d.id
    where to_tsvector('english', c.chunk_text) @@ plainto_tsquery('english', query_text)
      and (filter_uploaded_by is null or d.uploaded_by = filter_uploaded_by or d.uploaded_by is null)
      and (filter_document_ids is null or c.document_id = any(filter_document_ids))
  )
  select
    c.id as chunk_id,
    c.document_id,
    c.chunk_text,
    coalesce(v.sim_score, 0.0) * vector_weight + coalesce(k.fts_score, 0.0) * full_text_weight as similarity,
    c.page_number,
    c.section,
    c.metadata,
    d.title as document_title,
    d.filename as document_filename
  from public.document_chunks c
  join public.documents d on c.document_id = d.id
  left join vector_search v on c.id = v.cid
  left join keyword_search k on c.id = k.cid
  where (v.sim_score is not null or k.fts_score is not null)
    and (coalesce(v.sim_score, 0.0) * vector_weight + coalesce(k.fts_score, 0.0) * full_text_weight) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$;

-- Create Vector Index (HNSW)
-- Note: pgvector HNSW index is supported on Supabase.
-- Using 768 dimensions with cosine distance.
create index if not exists document_chunks_hnsw_idx
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

-- Create Full-Text Search Index
create index if not exists document_chunks_fts_idx
  on public.document_chunks
  using gin (to_tsvector('english', chunk_text));

-- Setup Storage for Documents
-- 1. Create the bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  52428800, -- 50MB
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do nothing;

-- 2. Storage policies for users
create policy "Allow users to upload their own documents"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Allow users to read their own documents"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Allow users to delete their own documents"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
