import type { BuzzInput } from "@/src/core/recommend";

/**
 * 中文播客榜 (xyzrank.com) — free JSON API built on 小宇宙 + Apple data,
 * the same source xyzrank.com itself renders. One cached fetch serves
 * every lookup; any failure returns null and the signal is skipped.
 * Endpoints per their docs: /api/podcasts (popular), /api/new-podcasts.
 */

const REVALIDATE_SECONDS = 24 * 60 * 60; // the ranking moves daily

type XyzEntry = {
  rank: number;
  subscribers?: number;
  plays?: number;
  comments?: number;
};

const normalizeTitle = (t: string) => t.trim().toLowerCase();

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;
}

/** Defensive parse: find the first array of objects bearing a name/title. */
function extractEntries(json: unknown): Map<string, XyzEntry> {
  const out = new Map<string, XyzEntry>();
  const arrays: unknown[][] = [];
  const walk = (node: unknown, depth: number) => {
    if (depth > 3 || !node) return;
    if (Array.isArray(node)) {
      arrays.push(node);
      return;
    }
    if (typeof node === "object") {
      for (const v of Object.values(node as Record<string, unknown>)) walk(v, depth + 1);
    }
  };
  walk(json, 0);

  for (const arr of arrays) {
    let rank = 0;
    for (const raw of arr) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const title = r.name ?? r.title ?? r.podcastName;
      if (typeof title !== "string" || !title.trim()) continue;
      rank += 1;
      const key = normalizeTitle(title);
      if (out.has(key)) continue;
      out.set(key, {
        rank,
        subscribers:
          asNumber(r.subscription) ?? asNumber(r.subscriptions) ??
          asNumber(r.subscriptionCount) ?? asNumber(r.followers),
        plays: asNumber(r.plays) ?? asNumber(r.playCount) ?? asNumber(r.playedCount),
        comments: asNumber(r.comments) ?? asNumber(r.commentCount),
      });
    }
    if (out.size > 0) break; // first plausible array is the ranking
  }
  return out;
}

let memo: Promise<Map<string, XyzEntry> | null> | null = null;

async function fetchIndex(): Promise<Map<string, XyzEntry> | null> {
  try {
    const res = await fetch("https://xyzrank.com/api/podcasts", {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { "User-Agent": "wavr/0.1 (personal podcast discovery)" },
    });
    if (!res.ok) return null;
    const entries = extractEntries(await res.json());
    return entries.size > 0 ? entries : null;
  } catch {
    return null;
  }
}

/** Rank + 小宇宙 stats for a show title, or null when unlisted/unreachable. */
export async function xyzrankBuzz(title: string): Promise<BuzzInput | null> {
  memo ??= fetchIndex();
  const index = await memo;
  if (!index) {
    memo = null; // retry on the next request rather than caching failure
    return null;
  }
  const entry = index.get(normalizeTitle(title));
  if (!entry) return null;
  return {
    xyzrankRank: entry.rank,
    subscribers: entry.subscribers,
    plays: entry.plays,
    comments: entry.comments,
  };
}
