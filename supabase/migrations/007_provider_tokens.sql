-- Server-only cache for provider access tokens that would otherwise be
-- lost on every serverless cold start (REFINEMENTS.md #18). RLS enabled
-- with no policies -- only the service-role key can touch this table,
-- mirroring ratings_cache.
-- Applied 2026-08-03 via MCP.
create table if not exists public.provider_tokens (
  provider text primary key,
  access_token text not null,
  updated_at timestamptz not null default now()
);
alter table public.provider_tokens enable row level security;
