/**
 * Swipe commit physics. PURE and unit-tested on purpose: these are the most
 * tunable numbers in the feature and the easiest to regress by thumb-feel.
 *
 * This is the single source of truth — the UI imports SWIPE from here rather
 * than keeping its own copy in the design tokens.
 */

export const SWIPE = {
  /** Fraction of card width past which a release commits. */
  distanceRatio: 0.28,
  /** Absolute floor, so a narrow viewport still needs a real gesture (px). */
  distanceMin: 88,
  /** Flick velocity that commits regardless of distance (px/s). */
  velocity: 550,
  /** Where the SAVE/SKIP stamps reach full opacity (px). */
  stampFull: 140,
  /** Max card rotation at full drag (deg). */
  maxRotate: 16,
} as const;

export type SwipeInput = {
  /** Horizontal offset from the drag origin (px). */
  dx: number;
  /** Horizontal velocity at release (px/s). */
  vx: number;
  /** Card width (px). */
  width: number;
};

export type SwipeOutcome = "save" | "skip" | "return";

/** The distance a release must clear to commit, for a given card width. */
export function commitDistance(width: number): number {
  return Math.max(SWIPE.distanceMin, width * SWIPE.distanceRatio);
}

/**
 * Right commits a save, left a skip, anything short springs back.
 *
 * A fast flick commits on velocity alone, and when it does, velocity also
 * decides the DIRECTION — otherwise flicking back leftwards from a card
 * dragged slightly right would save it, which is the opposite of what the
 * hand just did.
 */
export function decideSwipe({ dx, vx, width }: SwipeInput): SwipeOutcome {
  const byVelocity = Math.abs(vx) > SWIPE.velocity;
  const byDistance = Math.abs(dx) > commitDistance(width);
  if (!byVelocity && !byDistance) return "return";

  const dir = byVelocity ? Math.sign(vx) : Math.sign(dx);
  if (dir === 0) return "return";
  return dir > 0 ? "save" : "skip";
}
