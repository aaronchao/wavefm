-- Collection system (episodes to listen later + playback status).
-- Paste into the Supabase SQL editor once; the app degrades to
-- localStorage until this exists.

create table if not exists public.saved_episodes (
  user_id uuid not null references auth.users (id) on delete cascade,
  episode_id text not null,           -- iTunes trackId or feed-derived id
  show_id text,
  title text not null,
  show_title text,
  cover_url text,
  apple_url text,
  audio_url text,
  duration_sec int,
  status text not null default 'queued'
    check (status in ('queued', 'in_progress', 'finished')),
  position_sec int not null default 0, -- resume point (seconds)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, episode_id)
);
create index if not exists saved_episodes_user_idx
  on public.saved_episodes (user_id, updated_at desc);
alter table public.saved_episodes enable row level security;
create policy "own saved episodes"
  on public.saved_episodes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
