-- Generic server-only usage counters (REFINEMENTS.md #19: Listen Notes
-- monthly-cap kill-switch, and reusable for any other rate-limited free
-- tier later). RLS enabled with no policies -- service-role only.
-- Applied 2026-08-03 via MCP.
create table if not exists public.usage_counters (
  provider text not null,
  period text not null, -- "YYYY-MM"
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (provider, period)
);
alter table public.usage_counters enable row level security;
