-- Inbox/Queue triage + resequencing + personal feed sync + remembered player.
-- Applied 2026-08-03 via MCP.

alter table public.saved_episodes
  add column if not exists bucket text not null default 'inbox'
    check (bucket in ('inbox', 'queue', 'archived'));
alter table public.saved_episodes
  add column if not exists queue_rank double precision;

-- Every row that existed before this migration was saved under the old
-- flat-list model — treat those as already-triaged (queue), not freshly
-- dropped into the new Inbox. Assign an initial rank by save order.
with ranked as (
  select user_id, episode_id,
         row_number() over (partition by user_id order by created_at) as rn
  from public.saved_episodes
)
update public.saved_episodes se
set bucket = 'queue', queue_rank = ranked.rn
from ranked
where se.user_id = ranked.user_id and se.episode_id = ranked.episode_id;

create index if not exists saved_episodes_bucket_idx
  on public.saved_episodes (user_id, bucket, queue_rank);

alter table public.prefs
  add column if not exists feed_token uuid not null default gen_random_uuid();
alter table public.prefs
  add column if not exists preferred_player text
    check (preferred_player in ('apple', 'spotify', 'youtubeMusic', 'pocketCasts', 'xiaoyuzhou'));
