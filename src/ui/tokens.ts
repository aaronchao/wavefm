/** Design tokens shared by primitives and motion wrappers. */

/** Spring configs (Framer Motion) — playful, tactile, slight overshoot. */
export const springs = {
  /** Cards and tiles settling into place. */
  settle: { type: "spring", stiffness: 380, damping: 26, mass: 0.9 } as const,
  /** Press/tap feedback — snappy, no wobble. */
  press: { type: "spring", stiffness: 600, damping: 32 } as const,
  /** Chips and small elements popping in. */
  pop: { type: "spring", stiffness: 480, damping: 22 } as const,
};

/** Scale used for press feedback across all tappable primitives. */
export const PRESS_SCALE = 0.96;
