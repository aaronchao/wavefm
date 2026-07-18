import type { SparseVector } from "./types";
import { WEIGHTS } from "./weights";

export function cosine(a: SparseVector, b: SparseVector): number {
  // both vectors are L2-normalized, so cosine reduces to a dot product
  let dot = 0;
  const [small, large] = Object.keys(a).length <= Object.keys(b).length ? [a, b] : [b, a];
  for (const term in small) {
    const other = large[term];
    if (other !== undefined) dot += small[term] * other;
  }
  return dot;
}

export type ScoreOptions = {
  /** External rating 0..10; null/undefined = neutral (no bonus, no penalty). */
  rating?: number | null;
  /** λ in Section 8; how much a great rating can add. */
  ratingWeight?: number;
  /** Days since the show's latest episode; null/undefined = no bonus. */
  daysSinceLastEpisode?: number | null;
  /** How often this show was recently shown & ignored. */
  recentImpressions?: number;
};

export const DEFAULT_RATING_WEIGHT = WEIGHTS.rating;
const FRESH_WEEK_BONUS = WEIGHTS.freshWeekBonus;
const FRESH_MONTH_BONUS = WEIGHTS.freshMonthBonus;
const FATIGUE_PER_IMPRESSION = WEIGHTS.fatiguePerImpression;
const FATIGUE_CAP = WEIGHTS.fatigueCap;

/** score = cosine(taste, show) + λ·normRating + freshnessBonus − fatiguePenalty */
export function scoreCandidate(
  taste: SparseVector,
  showVector: SparseVector,
  opts: ScoreOptions = {},
): number {
  const sim = cosine(taste, showVector);

  const ratingWeight = opts.ratingWeight ?? DEFAULT_RATING_WEIGHT;
  const normRating =
    opts.rating == null ? 0 : Math.min(Math.max(opts.rating, 0), 10) / 10;

  const days = opts.daysSinceLastEpisode;
  const freshness =
    days == null ? 0 : days <= 7 ? FRESH_WEEK_BONUS : days <= 30 ? FRESH_MONTH_BONUS : 0;

  const fatigue =
    Math.min(opts.recentImpressions ?? 0, FATIGUE_CAP) * FATIGUE_PER_IMPRESSION;

  return sim + ratingWeight * normRating + freshness - fatigue;
}
