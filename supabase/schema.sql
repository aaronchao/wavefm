-- Wavr schema (Section 5 of CLAUDE.md). Paste into the Supabase SQL editor.
-- User rows are keyed by auth.uid(); shows/ratings_cache are shared read caches.

create table if not exists public.shows (
  id text primary key,               -- iTunes collectionId or pi-<feedId>
  itunes_id text,
  feed_url text,
  title text not null,
  author text,
  description text,
  categories text[] not null default '{}',
  language text,
  cover_url text,
  cluster_tags text[] not null default '{}',
  platform_links jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.shows enable row level security;
create policy "shows readable by everyone"
  on public.shows for select using (true);
create policy "signed-in users can cache shows"
  on public.shows for insert to authenticated with check (true);
create policy "signed-in users can refresh cached shows"
  on public.shows for update to authenticated using (true);

create table if not exists public.saved_shows (
  user_id uuid not null references auth.users (id) on delete cascade,
  show_id text not null references public.shows (id),
  created_at timestamptz not null default now(),
  primary key (user_id, show_id)
);
alter table public.saved_shows enable row level security;
create policy "own saved shows"
  on public.saved_shows for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.engagement (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  show_id text not null,
  type text not null check (type in ('save', 'like', 'open', 'block', 'impression')),
  weight real not null,
  created_at timestamptz not null default now()
);
create index if not exists engagement_user_idx on public.engagement (user_id, created_at desc);
alter table public.engagement enable row level security;
create policy "own engagement"
  on public.engagement for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  interests text[] not null default '{}',
  rating_sources jsonb not null default '{"douban": true, "xiaoyuzhou": true}',
  updated_at timestamptz not null default now()
);
alter table public.prefs enable row level security;
create policy "own prefs"
  on public.prefs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Listen-later collection: liked episodes with playback status/resume point.
create table if not exists public.saved_episodes (
  user_id uuid not null references auth.users (id) on delete cascade,
  episode_id text not null,
  show_id text,
  title text not null,
  show_title text,
  cover_url text,
  apple_url text,
  audio_url text,
  duration_sec int,
  status text not null default 'queued'
    check (status in ('queued', 'in_progress', 'finished')),
  position_sec int not null default 0,
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

create table if not exists public.ratings_cache (
  show_id text not null,
  source text not null,
  rating real,
  fetched_at timestamptz not null default now(),
  primary key (show_id, source)
);
alter table public.ratings_cache enable row level security;
create policy "ratings readable by everyone"
  on public.ratings_cache for select using (true);
-- ratings_cache writes happen server-side only (/api/ratings, M6).
