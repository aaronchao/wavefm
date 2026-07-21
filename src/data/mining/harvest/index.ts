import type { RawDoc } from "@/src/core/mining";
import { doubanSource } from "./douban";
import { hackerNewsSource } from "./hackernews";
import { pttSource } from "./ptt";
import { redditSource } from "./reddit";
import { v2exSource } from "./v2ex";
import type { HarvestSource, Seed } from "./types";

export type { HarvestSource, Seed } from "./types";
export { parseRedditListing } from "./reddit";
export { parseRssDocs } from "./douban";
export { parseHnHits } from "./hackernews";
export { parseSov2ex } from "./v2ex";
export { parsePttSearch, parsePttThread } from "./ptt";

/**
 * Harvest sources, all best-effort (null on failure). The two that use
 * fully-open APIs and work from CI without any setup — Hacker News (EN) and
 * V2EX/sov2ex (ZH) — lead as the reliable baseline; Reddit needs OAuth and
 * Douban needs RSSHub to contribute. PTT / Dcard / LIHKG and the promoted
 * Xiaohongshu / Discord adapters plug in here behind the same interface.
 */
export const SOURCES: HarvestSource[] = [
  hackerNewsSource,
  v2exSource,
  pttSource,
  redditSource,
  doubanSource,
];

/**
 * Run every source once for this seed set and return a deduped document pile.
 * Bulk sources fetch once; seeded sources are searched per seed. Purely
 * orchestration — extraction/scoring happens in /src/core/mining.
 */
export async function harvestAll(seeds: Seed[]): Promise<RawDoc[]> {
  const byId = new Map<string, RawDoc>();
  const add = (docs: RawDoc[] | null) => {
    for (const d of docs ?? []) if (!byId.has(d.id)) byId.set(d.id, d);
  };

  for (const src of SOURCES) {
    if (src.mode === "bulk") {
      add(await src.harvest());
    } else {
      for (const seed of seeds) add(await src.harvest(seed));
    }
  }
  return [...byId.values()];
}
