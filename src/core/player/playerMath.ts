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
 * episode in normal mode. Holding still past LONG_PRESS_MS (see
 * PlayerWaveformScrubber.tsx) engages "fine" mode — the same drag
 * distance now only sweeps a small fraction of the episode, for precise
 * positioning. (Was a drag-down gesture; Aaron asked to switch the
 * trigger to a long hold and make the zoom bigger, 2026-08-14 — see
 * PLAYER_ZOOM_SCALE below.)
 */
export const FINE_SCRUB_FACTOR = 1 / 10;
/** Waveform scale-up while fine mode is engaged — the visual "zoom in" cue. */
export const PLAYER_ZOOM_SCALE = 1.35;

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

export type Rect = { x: number; y: number; width: number; height: number };

/**
 * The card-to-player "grow from where you tapped" open animation
 * (Aaron's ask, 2026-08-14, after a Dribbble "Library" shot reference
 * video that never loaded despite retries — this is the standard FLIP
 * technique: compute the transform that makes the fullscreen target look
 * like `origin`, use it as Framer Motion's `initial`, then animate to
 * identity). Returns the collapsed-state transform relative to a
 * `viewportWidth`x`viewportHeight` fullscreen target.
 */
export function originTransform(origin: Rect, viewportWidth: number, viewportHeight: number) {
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return { x: 0, y: 0, scaleX: 1, scaleY: 1 };
  }
  return {
    x: origin.x + origin.width / 2 - viewportWidth / 2,
    y: origin.y + origin.height / 2 - viewportHeight / 2,
    scaleX: origin.width / viewportWidth,
    scaleY: origin.height / viewportHeight,
  };
}
