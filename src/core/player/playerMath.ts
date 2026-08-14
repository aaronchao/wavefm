/** Pure math for the full in-app player — no DOM, no React. */

export const PLAYBACK_SPEEDS = [1, 1.25, 1.5, 1.75, 2] as const;

/** Cycles to the next speed in PLAYBACK_SPEEDS, wrapping around. Falls
 *  back to the first speed if `current` isn't one of them. */
export function nextSpeed(current: number): number {
  const i = PLAYBACK_SPEEDS.indexOf(current as (typeof PLAYBACK_SPEEDS)[number]);
  return PLAYBACK_SPEEDS[i === -1 ? 0 : (i + 1) % PLAYBACK_SPEEDS.length];
}

/** "12:34" under an hour, "1:02:34" at or past one hour. Clamps negative
 *  input to 0 rather than rendering a negative time. */
export function formatTime(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * A horizontal drag across the FULL scrubber width sweeps the entire
 * episode in normal mode. Dragging your finger down past
 * FINE_SCRUB_ENGAGE_PX switches to "fine" mode — the same drag distance
 * now only sweeps a fraction of the episode, for precise positioning.
 * Mirrors the "drag down to slow the scrub speed" gesture from
 * Voice Memos / Apple Podcasts.
 */
export const FINE_SCRUB_FACTOR = 1 / 6;
export const FINE_SCRUB_ENGAGE_PX = 48;

export function scrubDeltaSec(
  dxPx: number,
  containerWidthPx: number,
  durationSec: number,
  fine: boolean,
): number {
  if (containerWidthPx <= 0 || !Number.isFinite(durationSec)) return 0;
  const factor = fine ? FINE_SCRUB_FACTOR : 1;
  return (dxPx / containerWidthPx) * durationSec * factor;
}

/** True once a vertical drag has gone far enough down to engage fine mode.
 *  Only downward drag counts — dragging up never engages it. */
export function isFineScrubEngaged(dyPx: number): boolean {
  return dyPx > FINE_SCRUB_ENGAGE_PX;
}
