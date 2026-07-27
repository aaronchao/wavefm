/**
 * Long-press overview scrubbing (docs/wavr-route-design.md §6.7). PURE.
 *
 * The finger's horizontal travel picks a card by detents. Rubber-banding at
 * the ends is a VIEW concern (the fan's x offset eases as you push past the
 * edge); this function's contract is simpler and stricter — the index it
 * returns is always in range.
 */

/** Pixels of travel per card. */
export const SCRUB_STEP = 64;

export type ScrubInput = {
  /** Horizontal offset from where the long-press began (px). */
  dx: number;
  /** Index the press started on. */
  startIndex: number;
  /** Number of cards available to scrub across. */
  count: number;
  step?: number;
};

/**
 * Index under the finger, detented every `step` px and clamped to the deck.
 * An empty deck scrubs to 0 so callers never handle -1.
 */
export function scrubTarget({
  dx,
  startIndex,
  count,
  step = SCRUB_STEP,
}: ScrubInput): number {
  if (count <= 0) return 0;
  const raw = startIndex + dx / step;
  const rounded = Math.round(raw);
  return Math.min(count - 1, Math.max(0, rounded));
}
