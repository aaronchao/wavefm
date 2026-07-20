import type { RawDoc } from "@/src/core/mining";
import { doubanSource } from "./douban";
import { redditSource } from "./reddit";
import type { HarvestSource, Seed } from "./types";

export type { HarvestSource, Seed } from "./types";
export { parseRedditListing } from "./reddit";
export { parseRssDocs } from "./douban";

/**
 * Wave-1 sources: Reddit (seeded, EN) + Douban (bulk, ZH). PTT / Dcard / LIHKG
 * and the promoted Xiaohongshu / Discord / Listen-Notes adapters plug in here
 * behind the same interface as later waves land.
 */
export const SOURCES: HarvestSource[] = [redditSource, doubanSource];

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
