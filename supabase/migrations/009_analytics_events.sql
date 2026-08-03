-- Minimal first-party analytics (REFINEMENTS.md #29) -- "is discovery
-- working" (saves/session, not-for-me rate, preview->open funnel)
-- without a third-party analytics vendor. Write-open, read-closed: any
-- signed-in user (or anonymous, user_id null) can insert their OWN
-- events; nobody can SELECT via anon/authenticated -- only the
-- service-role key reads, for analysis.
-- Applied 2026-08-03 via MCP.
create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  event text not null,
  show_id text,
  created_at timestamptz not null default now()
);
alter table public.analytics_events enable row level security;
create policy "insert own or anonymous events"
  on public.analytics_events for insert
  with check (user_id is null or auth.uid() = user_id);
create index if not exists analytics_events_event_idx
  on public.analytics_events (event, created_at desc);
