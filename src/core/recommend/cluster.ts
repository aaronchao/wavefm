import { cosine } from "./score";
import { tokenize } from "./tokenize";
import { l2Normalize } from "./vectorize";
import type { Cluster, ScoredCandidate, ShowInput, SparseVector } from "./types";

export type SeedCluster = {
  id: string;
  label: string;
  seedText: string;
  /** Hidden from the topic/interest pickers, but still used by the engine
   *  so niche taste is learned from what the user actually saves/likes. */
  hidden?: boolean;
};

/**
 * Seed clusters: trending / mainstream topics lead the pickers, followed
 * by broad exploration tags. Niche personal seeds live at the end marked
 * `hidden` — the recommender still clusters against them, but they don't
 * clutter the default topic chips.
 */
export const SEED_CLUSTERS: SeedCluster[] = [
  // trending / mainstream — these lead the pickers and cold-start
  {
    id: "news-politics",
    label: "news & politics",
    seedText: "news politics current events commentary analysis daily 新闻 时事",
  },
  {
    id: "true-crime",
    label: "true crime",
    seedText: "true crime murder investigation detective mystery case 悬疑 罪案",
  },
  {
    id: "comedy",
    label: "comedy",
    seedText: "comedy funny humor improv laugh stand-up jokes 喜剧 搞笑",
  },
  {
    id: "technology",
    label: "technology",
    seedText: "technology tech software ai internet startup gadgets 科技",
  },
  {
    id: "business",
    label: "business & finance",
    seedText:
      "business finance money investing economics entrepreneur coaching leadership 商业 投资",
  },
  {
    id: "health",
    label: "health & wellness",
    seedText: "health wellness fitness nutrition sleep meditation mindfulness 健康",
  },
  {
    id: "science",
    label: "science",
    seedText: "science physics biology space astronomy research discoveries 科学",
  },
  {
    id: "history",
    label: "history",
    seedText: "history historical ancient war civilization empire 历史",
  },
  {
    id: "storytelling",
    label: "storytelling",
    seedText: "storytelling story stories narrative personal candid life talk 故事",
  },
  {
    id: "society-culture",
    label: "society & culture",
    seedText: "society culture social interview conversation life ideas 文化 社会",
  },
  {
    id: "books",
    label: "book discussions",
    seedText: "book books reading literature author novel discussion club 读书",
  },
  {
    id: "music-culture",
    label: "music culture",
    seedText: "music culture artists albums hip hop rock interviews 音乐",
  },
  {
    id: "film-tv",
    label: "film & TV",
    seedText: "film movies cinema tv television series review criticism 电影 影视",
  },
  {
    id: "food",
    label: "food & cooking",
    seedText: "food cooking recipes restaurants chef eating cuisine 美食",
  },
  {
    id: "sports",
    label: "sports",
    seedText: "sports football basketball soccer nba training games 体育",
  },
  {
    id: "psych-cases",
    label: "psychological case studies",
    seedText:
      "psychology psychological case study studies therapy therapist mental health counseling",
  },
  // niche personal seeds — engine-only, not shown as default chips
  {
    id: "asian-gay",
    label: "Asian gay podcasts",
    seedText: "asian gay lgbtq queer chinese taiwanese 同志 同性 亚洲",
    hidden: true,
  },
  {
    id: "gay-travel",
    label: "gay travel stories",
    seedText: "gay lgbtq travel travels trip journey destination abroad stories",
    hidden: true,
  },
];

/** Topic labels shown in the pickers (excludes hidden personal seeds). */
export function defaultTopics(): string[] {
  return SEED_CLUSTERS.filter((s) => !s.hidden).map((s) => s.label);
}

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
