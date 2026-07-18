/**
 * All primary ranking weights in one place — tune here. Values are the
 * originals extracted from score/similar/topPicks; changing one is now a
 * single-line edit with unit tests to catch the effect.
 */
export const WEIGHTS = {
  // scoreCandidate (the clustered feed)
  rating: 0.15, // λ: how much a great external rating adds
  freshWeekBonus: 0.1,
  freshMonthBonus: 0.05,
  fatiguePerImpression: 0.05,
  fatigueCap: 5,
  // rankSimilar ("More like this")
  similarity: 0.7,
  popularity: 0.3,
  // topPicks (curated shelf)
  quality: 0.55,
  affinity: 0.45,
} as const;
