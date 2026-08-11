/**
 * Zero-cron "sync when you actually show up" throttle for Pocket Casts (PURE).
 *
 * A real background sync needs a Vercel cron (Hobby caps that at once a day
 * anyway) plus a service-role Supabase client to loop over every user's
 * stored token — real server infrastructure for a feature meant to stay
 * free and simple. Firing the same client-side sync the manual "Sync now"
 * button already makes, automatically, the moment the Library loads gets
 * the practical result users actually want (never remembering to press the
 * button) without any of that — just gated so it can't fire on every render
 * or every tab switch.
 */

/** Minimum time between auto-syncs. A manual sync resets this window too. */
export const AUTO_SYNC_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h

/**
 * Should an auto-sync fire right now? False whenever there's nothing to
 * sync (no connection) or it already ran recently — never on a guess about
 * an unparseable timestamp, which defaults to "go ahead and sync" rather
 * than silently never syncing again.
 */
export function shouldAutoSync(
  connected: boolean,
  lastSyncedAt: string | null | undefined,
  now: number,
): boolean {
  if (!connected) return false;
  if (!lastSyncedAt) return true;
  const last = Date.parse(lastSyncedAt);
  if (Number.isNaN(last)) return true;
  return now - last >= AUTO_SYNC_MIN_INTERVAL_MS;
}
