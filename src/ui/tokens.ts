/** Design tokens shared by primitives and motion wrappers. */

/** Spring configs (Framer Motion) — playful, tactile, slight overshoot. */
export const springs = {
  /** Cards and tiles settling into place. */
  settle: { type: "spring", stiffness: 380, damping: 26, mass: 0.9 } as const,
  /** Press/tap feedback — snappy, no wobble. */
  press: { type: "spring", stiffness: 600, damping: 32 } as const,
  /** Chips and small elements popping in. */
  pop: { type: "spring", stiffness: 480, damping: 22 } as const,
  /** Wavr: card returning to centre after an uncommitted drag. */
  snap: { type: "spring", stiffness: 520, damping: 34, mass: 0.8 } as const,
  /** Wavr: card thrown off screen — velocity is injected at call time. */
  fling: { type: "spring", stiffness: 220, damping: 28, mass: 0.7, restDelta: 0.5 } as const,
  /** Wavr: peek cards rising as the top card leaves. */
  rise: { type: "spring", stiffness: 300, damping: 30, mass: 0.9 } as const,
};

/** Scale used for press feedback across all tappable primitives. */
export const PRESS_SCALE = 0.96;
