import type { RawDoc } from "@/src/core/mining";
import { docLang, type HarvestSource, type Seed, USER_AGENT } from "./types";

/**
 * V2EX harvester via sov2ex (the community's open full-text search over V2EX).
 * A high-signal Chinese tech/interest community — exactly the off-chart chatter
 * we want. Unlike the buzz adapter (titles only), this uses the post `content`
 * the search already returns, so the extractor sees the shows a "求推荐播客"
 * thread actually lists — in one CI-friendly call, no auth. Best-effort: any
 * failure returns null.
 */

type SovHit = {
  _source?: { id?: number; title?: string; content?: string; member?: string };
};

/** PURE: turn a sov2ex response into harvest documents. */
export function parseSov2ex(json: unknown): RawDoc[] {
  const hits = (json as { hits?: SovHit[] })?.hits;
  if (!Array.isArray(hits)) return [];
  const out: RawDoc[] = [];
  for (const h of hits) {
    const s = h?._source;
    const title = s?.title?.trim();
    if (!s?.id || !title) continue;
    const body = s.content ?? "";
    out.push({
      id: `v2ex:${s.id}`,
      source: "v2ex",
      lang: docLang(`${title} ${body}`),
      title,
      body,
      author: s.member ? `v2ex:${s.member}` : "v2ex:anon",
      url: `https://www.v2ex.com/t/${s.id}`,
    });
  }
  return out;
}

async function harvest(seed: Seed): Promise<RawDoc[] | null> {
  // V2EX is a Chinese community — skip non-Chinese seeds (fewer, politer calls).
  if (!/\p{sc=Han}/u.test(seed.title)) return [];
  const q = encodeURIComponent(`${seed.title} 播客`);
  try {
    const res = await fetch(
      `https://www.sov2ex.com/api/search?q=${q}&size=20&sort=sumup`,
      { headers: { "User-Agent": USER_AGENT } },
    );
    if (!res.ok) return null;
    return parseSov2ex(await res.json());
  } catch {
    return null;
  }
}

export const v2exSource: HarvestSource = { id: "v2ex", mode: "seeded", harvest };
