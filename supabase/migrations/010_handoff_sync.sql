-- Cross-device handoff tracking for auto-retire + listen history.
--
-- Both shipped against localStorage first, because adding a column meant
-- migrating the live database and that wasn't a thing to do unattended. The
-- gap it left is real: hand an episode off on your phone and the desktop
-- neither retires it nor shows it in history, because the evidence lives on
-- the other device.
--
-- `opened_at` is when the episode was last handed off to an external player
-- (Apple, Spotify, Pocket Casts, ...). WaveFM can't observe playback there,
-- so this plus `duration_sec` is the whole basis of the auto-retire guess —
-- see src/core/library/autoRetire.ts.
--
-- `finished_inferred` records whether a finish was GUESSED rather than known.
-- The distinction is user-facing: the history view says "assumed finished"
-- so an inferred retire is legible instead of looking like magic.
--
-- Purely additive and nullable — no backfill, no rewrite. Existing rows have
-- never been handed off as far as we can prove, and null is exactly that.

alter table public.saved_episodes
  add column if not exists opened_at timestamptz;

alter table public.saved_episodes
  add column if not exists finished_inferred boolean not null default false;

-- Auto-retire scans "handed off, not yet finished" on every Library load.
create index if not exists saved_episodes_opened_at_idx
  on public.saved_episodes (user_id, opened_at)
  where opened_at is not null;
