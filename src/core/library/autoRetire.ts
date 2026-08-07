/**
 * Zero-credential "did I already listen to this?" inference (PURE).
 *
 * The pain point: finish an episode in Pocket Casts and it still sits in the
 * WaveFM queue, so keeping the queue honest is manual admin — exactly the
 * filing work the Right Now redesign set out to remove.
 *
 * Why infer rather than sync: a real played-status sync needs the player to
 * tell us. gpodder.net can (see /api/sync/gpodder) but Pocket Casts doesn't
 * speak it, and its own API is private and undocumented — it would need the
 * user's Pocket Casts password. So the default path assumes nothing about
 * the player: WaveFM knows when it handed an episode off, and roughly how
 * long the episode runs, which is enough to make a good guess.
 *
 * The guess is deliberately CONSERVATIVE and always reversible. Retiring
 * something unheard is the expensive error — the episode silently
 * disappears and the user never learns why — while leaving a finished one
 * in place costs one tap. So it waits for the full run time plus a healthy
 * grace margin, and everything it retires stays visible under "Recently
 * finished" with one-tap undo.
 */

export type HandoffEpisode = {
  episodeId: string;
  durationSec?: number;
  status: "queued" | "in_progress" | "finished";
  /** When the episode was last opened in an external player (ISO). */
  openedAt?: string;
};

/**
 * Extra time allowed on top of the episode's own duration before assuming
 * it was finished. People pause, take calls, and listen across a commute in
 * two halves, so "duration has elapsed" alone would retire far too eagerly.
 */
export const GRACE_MS = 6 * 60 * 60 * 1000; // 6 hours

/** Episodes with no known duration fall back to this before retiring. */
export const UNKNOWN_DURATION_MS = 24 * 60 * 60 * 1000;

/**
 * Has enough time passed since handoff that this episode is probably done?
 * False whenever we can't tell — never retire on a guess about a guess.
 */
export function isProbablyFinished(e: HandoffEpisode, now: number): boolean {
  if (e.status === "finished") return false; // already accounted for
  if (!e.openedAt) return false; // never handed off — nothing to infer from
  const opened = Date.parse(e.openedAt);
  if (Number.isNaN(opened)) return false;

  const runMs = e.durationSec != null ? e.durationSec * 1000 : UNKNOWN_DURATION_MS;
  return now - opened >= runMs + GRACE_MS;
}

/** The episodes to retire on this pass. */
export function episodesToRetire<T extends HandoffEpisode>(episodes: T[], now: number): T[] {
  return episodes.filter((e) => isProbablyFinished(e, now));
}

/**
 * Rough "how long until this is assumed finished", for explaining the
 * behaviour in the UI rather than having episodes vanish unannounced.
 * Null when it will never fire on its own.
 */
export function msUntilRetire(e: HandoffEpisode, now: number): number | null {
  if (e.status === "finished" || !e.openedAt) return null;
  const opened = Date.parse(e.openedAt);
  if (Number.isNaN(opened)) return null;
  const runMs = e.durationSec != null ? e.durationSec * 1000 : UNKNOWN_DURATION_MS;
  return Math.max(0, opened + runMs + GRACE_MS - now);
}
