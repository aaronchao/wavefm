-- User-generated tags per saved show. Powers the Library tag filter and the
-- show-detail tag input (both read/write the same rows). Paste into the
-- Supabase SQL editor once; the app degrades to localStorage until this
-- exists, so it stays a $0, best-effort sync.

create table if not exists public.show_tags (
  user_id uuid not null references auth.users (id) on delete cascade,
  show_id text not null,               -- catalog show id
  tag text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, show_id, tag)
);
create index if not exists show_tags_user_idx
  on public.show_tags (user_id, tag);
alter table public.show_tags enable row level security;
create policy "own show tags"
  on public.show_tags for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
