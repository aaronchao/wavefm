/**
 * Wavr's own clip spec — deliberately different from the app-wide 30s
 * preview (src/core/preview.ts): skip the intro, sample five minutes at
 * 1.25x so a card says something substantive fast. PURE and unit-tested.
 */

/** Skip past the cold open / ads before sampling anything. */
export const WAVR_INTRO_SKIP_SEC = 30;
/** Length of the sampled window. */
export const WAVR_CLIP_SEC = 300;
/** Leave this much room before the true end of the episode. */
const EDGE_PAD_SEC = 15;
/**
 * How far past the intro the start may jitter. Kept small ON PURPOSE: a seek
 * deep into an episode (minutes in) makes the CDN's Range response slow —
 * that deep-window seek was the main cause of "the Wavr audio takes too long
 * to load." Starting just past the intro keeps the Range request small so
 * playback begins within a second or two, while still varying per card.
 */
const WAVR_START_JITTER_SEC = 60;
/** Wavr plays every clip at this rate. */
export const WAVR_PLAYBACK_RATE = 1.25;

/**
 * A random-but-stable start point for a card's clip: just past the intro
 * (with a little jitter for variety), resolved against the CDN's real
 * duration once known. Deliberately shallow so the audio starts fast —
 * unknown/too-short durations fall back to right after the intro skip.
 */
export function wavrClipStart(durationSec: number | null | undefined, seed: number): number {
  const r = Math.min(Math.max(seed, 0), 1);
  if (durationSec == null || !Number.isFinite(durationSec)) return WAVR_INTRO_SKIP_SEC;
  // The largest offset that still leaves room for the full clip + end pad,
  // capped at the shallow jitter window so we never seek minutes-deep.
  const room = durationSec - WAVR_INTRO_SKIP_SEC - WAVR_CLIP_SEC - EDGE_PAD_SEC;
  if (room <= 0) return Math.max(0, Math.min(WAVR_INTRO_SKIP_SEC, durationSec - WAVR_CLIP_SEC));
  const jitter = Math.min(room, WAVR_START_JITTER_SEC);
  return WAVR_INTRO_SKIP_SEC + r * jitter;
}

/**
 * A deterministic 0..1 pseudo-random value from a card id — the same card
 * always samples the same slice, so the deck's hot-parking (which seeks
 * before playback is requested) and the actual clip window (which seeks
 * again once playback starts) agree on one origin instead of two different
 * random rolls landing on different parts of the episode.
 */
export function seedFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  }
  return (h >>> 0) / 0xffffffff;
}
