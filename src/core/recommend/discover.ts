import { buzzWhy, discussionScore } from "./buzz";
import { cosine } from "./score";
import type { SimilarItemInput } from "./similar";
import type { ShowInput, SparseVector } from "./types";
import { buildIdf, l2Normalize, vectorizeShow } from "./vectorize";

/**
 * Discussion-first, anti-chart recommendation (PURE) — the heart of Wavr's
 * value. People come here *because* the Apple/PI charts didn't help, so:
 *   1. a candidate must have real community discussion (Reddit / V2EX /
 *      小宇宙) to qualify at all;
 *   2. discussion dominates the score, with a light taste (affinity) nudge;
 *   3. shows currently on a mainstream chart are heavily penalised — the
 *      user has already seen those;
 *   4. "hidden gems" (well-discussed, low popularity, not charted) are
 *      flagged so the UI can celebrate them.
 * Deterministic; no per-view API cost.
 */
export type DiscoverPick = {
  item: SimilarItemInput;
  score: number;
  /** 0..1 pure human-discussion score. */
  discussion: number;
  /** Well-discussed, off the charts, not a mega-show. */
  hiddenGem: boolean;
  why: string;
};

export type DiscoverInput = {
  /** The user's saved shows (taste source). May be empty. */
  saved: ShowInput[];
  candidates: SimilarItemInput[];
  limit?: number;
};

/** Being on a chart the user has already scrolled is a strong negative. */
const CHART_PENALTY = 0.35;
const HIDDEN_GEM_MAX_SUBS = 50_000;
const NEUTRAL_AFFINITY = 0.5;

const normalizeTitle = (t: string) => t.trim().toLowerCase();

export function rankByDiscussion({
  saved,
  candidates,
  limit = 12,
}: DiscoverInput): DiscoverPick[] {
  const savedIds = new Set(saved.map((s) => s.id));
  const savedTitles = new Set(saved.map((s) => normalizeTitle(s.title)));
  const pool = candidates.filter(
    (c) => !savedIds.has(c.id) && !savedTitles.has(normalizeTitle(c.title)),
  );

  const idf = buildIdf([...saved, ...pool]);
  let taste: SparseVector | null = null;
  if (saved.length > 0) {
    const acc: SparseVector = {};
    for (const s of saved) {
      const v = vectorizeShow(s, idf);
      for (const term in v) acc[term] = (acc[term] ?? 0) + v[term];
    }
    taste = l2Normalize(acc);
  }

  const picks: DiscoverPick[] = [];
  for (const item of pool) {
    const discussion = discussionScore(item.buzz);
    if (discussion == null || discussion <= 0) continue; // require real chatter
    const charted = item.chartRank != null || item.trendRank != null;
    const affinity = taste ? cosine(taste, vectorizeShow(item, idf)) : NEUTRAL_AFFINITY;
    const ratingBonus =
      item.rating != null ? (Math.min(Math.max(item.rating, 0), 10) / 10) * 0.15 : 0;
    const base = 0.7 * discussion + 0.3 * affinity + ratingBonus;
    const score = charted ? base * CHART_PENALTY : base;
    const subs = item.buzz?.subscribers;
    const hiddenGem = !charted && (subs == null || subs < HIDDEN_GEM_MAX_SUBS) && discussion >= 0.25;
    const phrase = buzzWhy(item.buzz) ?? "Talked about in communities";
    picks.push({
      item,
      score,
      discussion,
      hiddenGem,
      why: hiddenGem ? `Under the radar · ${phrase}` : phrase,
    });
  }

  picks.sort(
    (a, b) =>
      b.score - a.score ||
      a.item.title.localeCompare(b.item.title) ||
      a.item.id.localeCompare(b.item.id),
  );
  return picks.slice(0, limit);
}
