import { detectLang } from "@/src/core/recommend/language";
import type { RawDoc } from "@/src/core/mining";

/** A show we want community recommendations for (drives seeded searches). */
export type Seed = { showId: string; title: string };

/**
 * A harvest source. Best-effort like every other external adapter: it returns
 * `null` when unreachable/unconfigured (never throws), so one dead upstream
 * shrinks the crop instead of failing the run.
 *  - "seeded": searched per seed title (e.g. Reddit search).
 *  - "bulk":   fetched once per run regardless of seed (e.g. Douban group feeds).
 * The extractor recovers each document's seed from its own title, so bulk docs
 * still produce correctly-attributed edges.
 */
export type HarvestSource =
  | { id: string; mode: "seeded"; harvest(seed: Seed): Promise<RawDoc[] | null> }
  | { id: string; mode: "bulk"; harvest(): Promise<RawDoc[] | null> };

/** Map the recommender's language enum onto RawDoc's coarser one. */
export function docLang(text: string): RawDoc["lang"] {
  const l = detectLang(text);
  return l === "zh" ? "zh" : l === "en" ? "en" : "other";
}

/** Crude HTML → text for RSS descriptions (tags out, a few entities in). */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

export const USER_AGENT = "wavefm/0.1 (podcast discovery; community mining)";
