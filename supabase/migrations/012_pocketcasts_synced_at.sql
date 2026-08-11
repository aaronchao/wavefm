-- Tracks when a Pocket Casts sync last ran, so the Library can auto-sync on
-- load (src/core/library/autoSync.ts) without hammering the unofficial API
-- on every visit. No cron involved — Vercel Hobby only runs cron once a
-- day anyway, and a real background job needs a service-role client to loop
-- over every user's stored token. Firing the same client-side sync the
-- manual button already makes, throttled by this column, gets the same
-- practical outcome for free. Set by every sync (manual or auto), so a
-- manual "Sync now" also resets the auto-throttle window.

alter table public.prefs
  add column if not exists pocketcasts_synced_at timestamptz;
