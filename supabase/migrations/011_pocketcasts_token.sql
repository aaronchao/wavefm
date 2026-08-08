-- Keep the user signed in to Pocket Casts between syncs.
--
-- The sync originally took email+password on every run and threw both away
-- immediately, which is safe but means re-typing a password to press one
-- button. Pocket Casts' login returns a bearer token, so the token is what
-- gets kept — the PASSWORD IS STILL NEVER STORED ANYWHERE, and a stored
-- token can be revoked by changing the Pocket Casts password, which a
-- stored password could not.
--
-- Lives on `prefs` rather than the service-role-only `provider_tokens`
-- table: that one is keyed by provider for app-wide credentials (小宇宙),
-- whereas this is per-user. `prefs` is already RLS'd so a row is readable
-- only by its owner — the same trust boundary as the browser session that
-- obtained the token, but it follows the user across devices instead of
-- being stranded in one browser's localStorage.

alter table public.prefs
  add column if not exists pocketcasts_token text;
