-- User-generated tags per saved episode — mirrors show_tags (004). Powers the
-- Library tag filter and each Episode card's inline tag input. Paste into the
-- Supabase SQL editor once; the app degrades to localStorage until this
-- exists, so it stays a $0, best-effort sync.

create table if not exists public.episode_tags (
  user_id uuid not null references auth.users (id) on delete cascade,
  episode_id text not null,            -- iTunes trackId or feed-derived id
  tag text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, episode_id, tag)
);
create index if not exists episode_tags_user_idx
  on public.episode_tags (user_id, tag);
alter table public.episode_tags enable row level security;
create policy "own episode tags"
  on public.episode_tags for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
