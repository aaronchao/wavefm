import type { EngagementType } from "@/src/core/engagement";

/** Plain-data inputs — core never imports from /data, React, or Next. */

export type ShowInput = {
  id: string;
  title: string;
  description?: string;
  categories: string[];
  clusterTags?: string[];
  /** ISO date of the latest episode, if known (freshness signal). */
  lastEpisodeAt?: string;
};

export type EngagementInput = {
  showId: string;
  type: EngagementType;
};

export type RatingInput = {
  source: string; // "douban" | "xiaoyuzhou" | ...
  rating: number; // 0..10
};

/** Sparse term-weight vector; L2-normalized unless stated otherwise. */
export type SparseVector = Record<string, number>;

export type ScoredCandidate = {
  show: ShowInput;
  vector: SparseVector;
  score: number;
  rating?: RatingInput;
};

export type Cluster = {
  id: string;
  label: string;
  /** Human reason shown as a chip — explainability is the feature. */
  why: string;
  items: ScoredCandidate[];
};
