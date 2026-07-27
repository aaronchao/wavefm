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
/** Wavr plays every clip at this rate. */
export const WAVR_PLAYBACK_RATE = 1.25;

/**
 * A random-but-stable start point for a card's clip: after the intro, before
 * the episode runs out, resolved against the CDN's real duration once known.
 * Unknown/too-short durations fall back to right after the intro skip.
 */
export function wavrClipStart(durationSec: number | null | undefined, seed: number): number {
  const r = Math.min(Math.max(seed, 0), 1);
  if (durationSec == null || !Number.isFinite(durationSec)) return WAVR_INTRO_SKIP_SEC;
  const usable = durationSec - WAVR_INTRO_SKIP_SEC - WAVR_CLIP_SEC - EDGE_PAD_SEC;
  if (usable <= 0) return Math.max(0, Math.min(WAVR_INTRO_SKIP_SEC, durationSec - WAVR_CLIP_SEC));
  return WAVR_INTRO_SKIP_SEC + r * usable;
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
