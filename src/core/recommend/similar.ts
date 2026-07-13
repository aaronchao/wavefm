import { buzzScore, buzzWhy, type BuzzInput } from "./buzz";
import { cosine } from "./score";
import { buildIdf, termWeights, vectorizeShow } from "./vectorize";
import type { ShowInput } from "./types";

/**
 * "More like this": rank candidates (shows OR episodes) against a seed
 * show by content similarity blended with free-API popularity metrics.
 * True listen counts aren't public anywhere, so popularity is proxied by
 * chart rank, trending rank, episode count, publishing recency and
 * external rating — each optional; missing metrics stay neutral.
 */

export type SimilarItemInput = {
  id: string;
  title: string;
  description?: string;
  categories: string[];
  /** ISO date of the latest episode (shows) or publish date (episodes). */
  lastEpisodeAt?: string;
  /** Total episodes published (longevity proxy). */
  episodeCount?: number;
  /** 1-based position on the Apple top chart, if present. */
  chartRank?: number;
  /** 1-based position on the Podcast Index trending list, if present. */
  trendRank?: number;
  /** External rating 0..10 (Douban/Xiaoyuzhou), if cached. */
  rating?: number;
  ratingSource?: string;
  /** Quality-discussion counts (Reddit / xyzrank / 小宇宙), if gathered. */
  buzz?: BuzzInput;
};

export type RankedSimilar = {
  item: SimilarItemInput;
  /** Blended rank score (higher = better match). */
  score: number;
  /** Pure topical cosine 0..1. */
  similarity: number;
  /** Blended popularity 0..1 (0.5 when no metrics known). */
  popularity: number;
  /** Human explanation — explainability is the feature. */
  why: string;
};

const SIMILARITY_WEIGHT = 0.7;
const POPULARITY_WEIGHT = 0.3;
const CHART_SIZE = 100; // both charts are top-100 lists
const NEUTRAL_POPULARITY = 0.5;

function recencyScore(days: number): number {
  return days <= 7 ? 1 : days <= 30 ? 0.7 : days <= 90 ? 0.4 : 0.15;
}

function longevityScore(count: number): number {
  // log-scaled: 10 eps ≈ 0.4, 100 ≈ 0.8, 300+ ≈ 1
  return Math.min(1, Math.log10(count + 1) / 2.5);
}

function rankScore(rank: number): number {
  return Math.max(0, 1 - (rank - 1) / CHART_SIZE);
}

type Metric = { key: string; value: number; phrase: string | null };

function metrics(item: SimilarItemInput, now: Date): Metric[] {
  const out: Metric[] = [];
  if (item.chartRank != null) {
    out.push({
      key: "chart",
      value: rankScore(item.chartRank),
      phrase: `#${item.chartRank} on Apple charts`,
    });
  }
  if (item.trendRank != null) {
    out.push({
      key: "trend",
      value: rankScore(item.trendRank),
      phrase: "Trending on Podcast Index",
    });
  }
  if (item.rating != null) {
    const source = item.ratingSource
      ? item.ratingSource.charAt(0).toUpperCase() + item.ratingSource.slice(1)
      : null;
    out.push({
      key: "rating",
      value: Math.min(Math.max(item.rating, 0), 10) / 10,
      phrase:
        item.rating >= 8
          ? `Rated ${item.rating}${source ? ` on ${source}` : ""}`
          : null,
    });
  }
  if (item.lastEpisodeAt && !Number.isNaN(Date.parse(item.lastEpisodeAt))) {
    const days = Math.max(
      0,
      (now.getTime() - Date.parse(item.lastEpisodeAt)) / 86_400_000,
    );
    out.push({
      key: "recency",
      value: recencyScore(days),
      phrase: days <= 7 ? "New this week" : days <= 30 ? "Active this month" : null,
    });
  }
  if (item.episodeCount != null && item.episodeCount > 0) {
    out.push({
      key: "longevity",
      value: longevityScore(item.episodeCount),
      phrase:
        item.episodeCount >= 100
          ? `Long-running (${item.episodeCount} episodes)`
          : null,
    });
  }
  const buzz = buzzScore(item.buzz);
  if (buzz !== null) {
    out.push({ key: "buzz", value: buzz, phrase: buzzWhy(item.buzz) });
  }
  return out;
}

/**
 * Blended 0..1 quality/popularity from whichever metrics are present
 * (null when none), plus the strongest human phrase. Shared by
 * rankSimilar and topPicks.
 */
export function qualityOf(
  item: SimilarItemInput,
  now: Date,
): { quality: number | null; phrase: string | null } {
  const m = metrics(item, now);
  if (m.length === 0) return { quality: null, phrase: null };
  const best = m
    .filter((x) => x.phrase !== null)
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))[0];
  return {
    quality: m.reduce((s, x) => s + x.value, 0) / m.length,
    phrase: best?.phrase ?? null,
  };
}

function similarityPhrase(similarity: number): string {
  if (similarity >= 0.5) return "Very similar topics";
  if (similarity >= 0.25) return "Similar topics";
  if (similarity >= 0.1) return "Related topics";
  return "A different flavor";
}

function why(similarity: number, m: Metric[]): string {
  // strongest metric with a phrase gets the second slot
  const best = m
    .filter((x) => x.phrase !== null)
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))[0];
  const base = similarityPhrase(similarity);
  return best?.phrase ? `${base} · ${best.phrase}` : base;
}

const normalizeTitle = (t: string) => t.trim().toLowerCase();

export type RankSimilarOptions = {
  /** "Now" for recency math — pass a fixed date in tests. */
  now?: Date;
  limit?: number;
};

/**
 * Rank candidates against a seed show. Pure and deterministic:
 * score = 0.7·cosine(seed, item) + 0.3·popularity, where popularity is
 * the mean of whichever metrics are present (none present = 0.5 neutral).
 * The seed itself (same id or same title) is excluded.
 */
export function rankSimilar(
  seed: ShowInput,
  candidates: SimilarItemInput[],
  opts: RankSimilarOptions = {},
): RankedSimilar[] {
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? 12;
  const seedTitle = normalizeTitle(seed.title);

  const pool = candidates.filter(
    (c) => c.id !== seed.id && normalizeTitle(c.title) !== seedTitle,
  );

  const idf = buildIdf([seed, ...pool]);
  const seedVector = vectorizeShow(seed, idf);

  const ranked: RankedSimilar[] = pool.map((item) => {
    const similarity = cosine(seedVector, vectorizeShow(item, idf));
    const m = metrics(item, now);
    const popularity =
      m.length === 0
        ? NEUTRAL_POPULARITY
        : m.reduce((sum, x) => sum + x.value, 0) / m.length;
    return {
      item,
      similarity,
      popularity,
      score: SIMILARITY_WEIGHT * similarity + POPULARITY_WEIGHT * popularity,
      why: why(similarity, m),
    };
  });

  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      a.item.title.localeCompare(b.item.title) ||
      a.item.id.localeCompare(b.item.id),
  );
  return ranked.slice(0, limit);
}

/**
 * Top query terms for gathering candidates from catalog search APIs.
 * Field-weighted TF (categories > title > description), deterministic.
 * Single CJK characters are skipped in favor of their bigrams.
 */
export function queryTermsForShow(show: ShowInput, n = 5): string[] {
  const tf = termWeights(show);
  return Object.keys(tf)
    .filter((t) => t.length > 1)
    .sort((a, b) => tf[b] - tf[a] || a.localeCompare(b))
    .slice(0, n);
}
