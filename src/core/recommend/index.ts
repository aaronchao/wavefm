import { cluster } from "./cluster";
import { diversify, type DiversifyCaps } from "./diversify";
import { scoreCandidate, DEFAULT_RATING_WEIGHT } from "./score";
import { tasteVector } from "./taste";
import { buildIdf, vectorizeShow } from "./vectorize";
import type {
  Cluster,
  EngagementInput,
  RatingInput,
  ScoredCandidate,
  ShowInput,
  SparseVector,
} from "./types";

export * from "./types";
export { tokenize } from "./tokenize";
export { buildIdf, l2Normalize, termWeights, vectorizeShow } from "./vectorize";
export { tasteVector } from "./taste";
export { cosine, scoreCandidate, DEFAULT_RATING_WEIGHT } from "./score";
export { cluster, SEED_CLUSTERS, seedVectors, defaultTopics } from "./cluster";
export type { SeedCluster } from "./cluster";
export { diversify } from "./diversify";
export { rankSimilar, queryTermsForShow, qualityOf } from "./similar";
export type { SimilarItemInput, RankedSimilar } from "./similar";
export { buzzScore, buzzWhy } from "./buzz";
export type { BuzzInput } from "./buzz";
export { rankEpisodes } from "./episodes";
export type { EpisodeInput, RankedEpisode, EpisodeBasis } from "./episodes";
export { topPicks } from "./topPicks";
export type { TopPick, TopPicksInput } from "./topPicks";

export type RecommendInput = {
  /** Shows to rank (from catalog search / trending / seeds). */
  candidates: ShowInput[];
  /** The user's engagement history. */
  engagements: EngagementInput[];
  /** Metadata for engaged shows (so history can be vectorized). */
  engagedShows: ShowInput[];
  /** Onboarding interest picks (seed cluster labels or free text). */
  interests?: string[];
  /** Best-known external rating per show id; missing = neutral. */
  ratings?: Record<string, RatingInput>;
  /** Recent impression counts per show id (fatigue). */
  impressions?: Record<string, number>;
  /** "Now" for freshness math — pass a fixed date in tests. */
  now?: Date;
  caps?: DiversifyCaps;
};

/**
 * The whole pipeline (Section 8): vectorize -> taste -> score -> cluster
 * -> diversify. Pure and deterministic; no I/O, no per-view API cost.
 */
export function recommend(input: RecommendInput): Cluster[] {
  const now = input.now ?? new Date();

  const corpus = [...input.candidates, ...input.engagedShows];
  const idf = buildIdf(corpus);

  const engagedVectors: Record<string, SparseVector> = {};
  for (const show of input.engagedShows) {
    engagedVectors[show.id] = vectorizeShow(show, idf);
  }

  const taste = tasteVector(input.engagements, engagedVectors, input.interests);

  const blocked = new Set(
    input.engagements.filter((e) => e.type === "block").map((e) => e.showId),
  );
  const alreadySaved = new Set(
    input.engagements.filter((e) => e.type === "save").map((e) => e.showId),
  );

  const scored: ScoredCandidate[] = [];
  for (const show of input.candidates) {
    if (blocked.has(show.id) || alreadySaved.has(show.id)) continue;
    const vector = vectorizeShow(show, idf);
    const rating = input.ratings?.[show.id];
    const days = show.lastEpisodeAt
      ? Math.max(0, (now.getTime() - Date.parse(show.lastEpisodeAt)) / 86_400_000)
      : null;
    const score = scoreCandidate(taste, vector, {
      rating: rating?.rating,
      ratingWeight: DEFAULT_RATING_WEIGHT,
      daysSinceLastEpisode: days,
      recentImpressions: input.impressions?.[show.id] ?? 0,
    });
    scored.push({ show, vector, score, rating });
  }

  const saved = input.engagements
    .filter((e) => e.type === "save")
    .map((e) => {
      const show = input.engagedShows.find((s) => s.id === e.showId);
      return show ? { show, vector: engagedVectors[show.id] } : null;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  return diversify(cluster(scored, { saved }), input.caps);
}
