import type { RawDoc } from "@/src/core/mining";
import { parseRssDocs } from "./douban";
import { type HarvestSource, USER_AGENT } from "./types";

/**
 * Zhihu (知乎) harvester — REFINEMENTS.md #8: the biggest gap in the CN
 * signal set. Douban/Xiaoyuzhou/PTT/LIHKG/Dcard are all ratings/forum-
 * chatter; none of it is curated "求推荐播客" (please recommend a podcast)
 * discussion the way Reddit is for English. Zhihu's recommendation-thread
 * genre is the closest CN equivalent.
 *
 * Zhihu's API is closed, same situation as Douban — read via RSSHub
 * (RSSHUB_BASE, same env var the Douban harvester already uses) rather
 * than scraping directly. Mirrors doubanSource's exact shape: a
 * comma-separated list of topic ids to watch (ZHIHU_TOPIC_IDS), bulk-
 * fetched once per run; disabled (returns null) until topics are set.
 *
 * ⚠️ Route path unverified live: RSSHub's public instance sits behind a
 * Cloudflare bot challenge from this environment, so `/zhihu/topic/:id`
 * (RSSHub's documented topic-feed route shape) could not be confirmed
 * against a real response the way the Douban route was. Verify this path
 * once you have an RSSHub instance reachable (self-hosted sidesteps the
 * Cloudflare challenge) — if RSSHub has since renamed/changed the route,
 * this is the one line to fix.
 */

async function harvest(): Promise<RawDoc[] | null> {
  const topics = (process.env.ZHIHU_TOPIC_IDS ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (topics.length === 0) return null; // not configured → cleanly disabled
  const base = (process.env.RSSHUB_BASE ?? "https://rsshub.app").replace(/\/$/, "");

  const out: RawDoc[] = [];
  let anyOk = false;
  for (const t of topics) {
    try {
      const res = await fetch(`${base}/zhihu/topic/${encodeURIComponent(t)}`, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!res.ok) continue;
      anyOk = true;
      out.push(...parseRssDocs(await res.text(), "zhihu"));
    } catch {
      // one dead topic/instance shouldn't abort the rest
    }
  }
  return anyOk ? out : null;
}

export const zhihuSource: HarvestSource = { id: "zhihu", mode: "bulk", harvest };
