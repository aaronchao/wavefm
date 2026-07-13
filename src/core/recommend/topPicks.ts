import { cosine } from "./score";
import { qualityOf, type SimilarItemInput } from "./similar";
import { buildIdf, l2Normalize, vectorizeShow } from "./vectorize";
import type { ShowInput, SparseVector } from "./types";

/**
 * Top Picks — PURE. Curates highly rated / high-buzz shows, biased
 * toward the user's taste (their saved shows). Quality leads, affinity
 * follows: this is the "you can trust these" shelf, not the feed.
 */

export type TopPick = {
  item: SimilarItemInput;
  score: number;
  /** 0..1 blended quality (rating, charts, trending, buzz…). */
  quality: number;
  /** 0..1 cosine to the taste vector built from saved shows. */
  affinity: number;
  why: string;
};

const QUALITY_WEIGHT = 0.55;
const AFFINITY_WEIGHT = 0.45;
/** Quality prior for candidates with no signals at all. */
const UNKNOWN_QUALITY = 0.35;
/** Affinity is neutral when the user has saved nothing yet. */
const NEUTRAL_AFFINITY = 0.5;
const HIGH_AFFINITY = 0.2;

const normalizeTitle = (t: string) => t.trim().toLowerCase();

export type TopPicksInput = {
  /** The user's saved shows (taste source). May be empty. */
  saved: ShowInput[];
  candidates: SimilarItemInput[];
  now?: Date;
  limit?: number;
};

export function topPicks({
  saved,
  candidates,
  now = new Date(),
  limit = 10,
}: TopPicksInput): TopPick[] {
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

  const picks: TopPick[] = pool.map((item) => {
    const { quality, phrase } = qualityOf(item, now);
    const q = quality ?? UNKNOWN_QUALITY;
    const affinity = taste
      ? cosine(taste, vectorizeShow(item, idf))
      : NEUTRAL_AFFINITY;
    const whyParts = [
      phrase ?? "Worth a listen",
      ...(taste && affinity >= HIGH_AFFINITY ? ["matches your taste"] : []),
    ];
    return {
      item,
      quality: q,
      affinity,
      score: QUALITY_WEIGHT * q + AFFINITY_WEIGHT * affinity,
      why: whyParts.join(" · "),
    };
  });

  picks.sort(
    (a, b) =>
      b.score - a.score ||
      a.item.title.localeCompare(b.item.title) ||
      a.item.id.localeCompare(b.item.id),
  );
  return picks.slice(0, limit);
}
