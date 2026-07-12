// Engagement types and weights (Section 5). PURE module — used by the
// recommendation engine (M4) and by repos when recording events.

export const ENGAGEMENT_WEIGHTS = {
  save: 3,
  like: 2,
  open: 1,
  block: -3,
  impression: -0.5,
} as const;

export type EngagementType = keyof typeof ENGAGEMENT_WEIGHTS;
