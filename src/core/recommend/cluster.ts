import { cosine } from "./score";
import { tokenize } from "./tokenize";
import { l2Normalize } from "./vectorize";
import type { Cluster, ScoredCandidate, ShowInput, SparseVector } from "./types";

/** Cold-start seed clusters (Section 8.6). */
export const SEED_CLUSTERS: { id: string; label: string; seedText: string }[] = [
  {
    id: "asian-gay",
    label: "Asian gay podcasts",
    seedText: "asian gay lgbtq queer chinese taiwanese 同志 同性 亚洲",
  },
  {
    id: "gay-travel",
    label: "gay travel stories",
    seedText: "gay lgbtq travel travels trip journey destination abroad stories",
  },
  {
    id: "storytelling",
    label: "storytelling",
    seedText: "storytelling story stories narrative personal candid life talk 故事",
  },
  {
    id: "psych-cases",
    label: "psychological case studies",
    seedText:
      "psychology psychological case study studies therapy therapist mental health counseling",
  },
  {
    id: "books",
    label: "book discussions",
    seedText: "book books reading literature author novel discussion club 读书",
  },
];

const SEED_MATCH_THRESHOLD = 0.08;
const SAVED_SIMILARITY_THRESHOLD = 0.35;
const HIGH_RATING_THRESHOLD = 8;

export function seedVectors(): { id: string; label: string; vector: SparseVector }[] {
  return SEED_CLUSTERS.map((s) => {
    const acc: SparseVector = {};
    for (const t of tokenize(s.seedText)) acc[t] = (acc[t] ?? 0) + 1;
    return { id: s.id, label: s.label, vector: l2Normalize(acc) };
  });
}

export type ClusterOptions = {
  /** Saved shows (with vectors) to power "Because you saved X" groups. */
  saved?: { show: ShowInput; vector: SparseVector }[];
};

/**
 * Assigns each candidate to exactly one topic group, each with a human
 * "why". Priority per candidate (deterministic):
 *   1. very similar to a saved show  -> "Because you saved <title>"
 *   2. matches a seed cluster        -> "More <label>"
 *   3. highly rated                  -> "Highly rated on <source>"
 *   4. fallback: top category        -> "More <category>"
 * Clusters keep candidate insertion order; callers sort via diversify().
 */
export function cluster(
  candidates: ScoredCandidate[],
  opts: ClusterOptions = {},
): Cluster[] {
  const seeds = seedVectors();
  const byId = new Map<string, Cluster>();

  const put = (id: string, label: string, why: string, item: ScoredCandidate) => {
    let c = byId.get(id);
    if (!c) {
      c = { id, label, why, items: [] };
      byId.set(id, c);
    }
    c.items.push(item);
  };

  for (const item of candidates) {
    // 1. similar to something you saved
    let bestSaved: { title: string; sim: number } | null = null;
    for (const s of opts.saved ?? []) {
      if (s.show.id === item.show.id) continue;
      const sim = cosine(s.vector, item.vector);
      if (sim >= SAVED_SIMILARITY_THRESHOLD && (!bestSaved || sim > bestSaved.sim)) {
        bestSaved = { title: s.show.title, sim };
      }
    }
    if (bestSaved) {
      put(
        `saved:${bestSaved.title}`,
        bestSaved.title,
        `Because you saved ${bestSaved.title}`,
        item,
      );
      continue;
    }

    // 2. seed cluster
    let bestSeed: { id: string; label: string; sim: number } | null = null;
    for (const seed of seeds) {
      const sim = cosine(seed.vector, item.vector);
      if (sim >= SEED_MATCH_THRESHOLD && (!bestSeed || sim > bestSeed.sim)) {
        bestSeed = { id: seed.id, label: seed.label, sim };
      }
    }
    if (bestSeed) {
      put(bestSeed.id, bestSeed.label, `More ${bestSeed.label}`, item);
      continue;
    }

    // 3. highly rated discovery
    if (item.rating && item.rating.rating >= HIGH_RATING_THRESHOLD) {
      const source = item.rating.source;
      const pretty = source.charAt(0).toUpperCase() + source.slice(1);
      put(`rated:${source}`, `Highly rated`, `Highly rated on ${pretty}`, item);
      continue;
    }

    // 4. category fallback
    const category = item.show.categories[0] ?? "Discovery";
    put(`cat:${category.toLowerCase()}`, category, `More ${category}`, item);
  }

  return [...byId.values()];
}
