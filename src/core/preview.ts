/**
 * Preview-clip math (PURE module): where a 30-second teaser starts inside
 * an episode, and which episode of a show to sample. Randomness comes in
 * as a plain 0..1 number so everything stays deterministic and testable.
 */

export const CLIP_SECONDS = 30;
/** Skip the very start (intros/ads) and leave room before the end. */
const EDGE_PAD_SECONDS = 15;

/**
 * Random clip start inside an episode. Unknown/short durations start at 0
 * (the player clamps again once real metadata loads).
 */
export function clipStart(
  durationSec: number | null | undefined,
  rand: number,
  clipLen = CLIP_SECONDS,
  edgePad = EDGE_PAD_SECONDS,
): number {
  if (durationSec == null || !Number.isFinite(durationSec)) return 0;
  const r = Math.min(Math.max(rand, 0), 1);
  const usable = durationSec - clipLen - edgePad * 2;
  if (usable <= 0) return 0;
  return Math.floor(edgePad + r * usable);
}

/**
 * Where to start a "random section of the middle" clip, as a fraction of
 * the episode's true duration. Biased to the central fifth ([0.40, 0.60))
 * so a one-click preview lands on real content — never the cold open,
 * sponsor read, or sign-off. The player resolves this against the CDN's
 * real duration on load, so it's correct even when RSS omits a length.
 */
export function middleFraction(rand: number): number {
  const r = Math.min(Math.max(rand, 0), 1);
  return 0.4 + r * 0.2;
}

/** Pick an index in [0, count) from a 0..1 random number. */
export function pickIndex(count: number, rand: number): number {
  if (count <= 0) return 0;
  const r = Math.min(Math.max(rand, 0), 1);
  return Math.min(count - 1, Math.floor(r * count));
}

/**
 * Parse an RSS <itunes:duration> value: plain seconds ("1830"),
 * MM:SS ("30:30") or HH:MM:SS ("1:02:03"). Unparseable -> undefined.
 */
export function parseItunesDuration(
  value: string | number | null | undefined,
): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
  }
  const text = value.trim();
  if (!text) return undefined;
  if (!/^\d+(:\d{1,2}){0,2}$/.test(text)) return undefined;
  const parts = text.split(":").map(Number);
  const seconds = parts.reduce((acc, p) => acc * 60 + p, 0);
  return seconds > 0 ? seconds : undefined;
}
