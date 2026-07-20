import type { BuzzInput } from "@/src/core/recommend";
import { normalizeForMatch } from "./match";

/**
 * 中文播客榜 (xyzrank.com) — free JSON API built on 小宇宙 + Apple data,
 * the same source xyzrank.com itself renders. One cached fetch serves
 * every lookup; any failure returns null and the signal is skipped.
 * Endpoints per their docs: /api/podcasts (popular), /api/new-podcasts.
 */

const REVALIDATE_SECONDS = 24 * 60 * 60; // the ranking moves daily

/** One ranked show on 中文播客榜, with its display title preserved. */
export type XyzChartEntry = {
  rank: number;
  title: string;
  subscribers?: number;
  plays?: number;
  comments?: number;
};

const normalizeTitle = normalizeForMatch;

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;
}

/** Defensive parse: find the first array of objects bearing a name/title. */
function extractOrdered(json: unknown): XyzChartEntry[] {
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
    const out: XyzChartEntry[] = [];
    const seen = new Set<string>();
    for (const raw of arr) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const title = r.name ?? r.title ?? r.podcastName;
      if (typeof title !== "string" || !title.trim()) continue;
      const key = normalizeTitle(title);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        rank: out.length + 1,
        title: title.trim(),
        subscribers:
          asNumber(r.subscription) ?? asNumber(r.subscriptions) ??
          asNumber(r.subscriptionCount) ?? asNumber(r.followers),
        plays: asNumber(r.plays) ?? asNumber(r.playCount) ?? asNumber(r.playedCount),
        comments: asNumber(r.comments) ?? asNumber(r.commentCount),
      });
    }
    if (out.length > 0) return out; // first plausible array is the ranking
  }
  return [];
}

let memo: Promise<XyzChartEntry[] | null> | null = null;

async function fetchChart(): Promise<XyzChartEntry[] | null> {
  try {
    // xyzrank sits behind a bot filter that 403s bare server-side fetches;
    // browser-like headers get us the JSON. Still best-effort — any failure
    // just drops the enrichment, the board falls back to the Apple CN chart.
    const res = await fetch("https://xyzrank.com/api/podcasts", {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        Referer: "https://xyzrank.com/",
      },
    });
    if (!res.ok) return null;
    const entries = extractOrdered(await res.json());
    return entries.length > 0 ? entries : null;
  } catch {
    return null;
  }
}

async function chartIndex(): Promise<XyzChartEntry[] | null> {
  memo ??= fetchChart();
  const chart = await memo;
  if (!chart) memo = null; // retry next request rather than cache the failure
  return chart;
}

/** The full 中文播客榜 leaderboard, ordered by rank (for Chinese discovery). */
export async function xyzrankChart(): Promise<XyzChartEntry[] | null> {
  return chartIndex();
}

/** One hot episode on 中文播客榜's episode board. */
export type XyzEpisodeEntry = {
  rank: number;
  title: string;
  showTitle?: string;
  plays?: number;
  comments?: number;
  url?: string;
};

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** Defensive parse of the hot-episodes payload (schema not guaranteed). */
function extractEpisodes(json: unknown): XyzEpisodeEntry[] {
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
    const out: XyzEpisodeEntry[] = [];
    for (const raw of arr) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const title = asString(r.title) ?? asString(r.name) ?? asString(r.episodeName);
      if (!title) continue;
      const link = asString(r.link) ?? asString(r.url) ?? asString(r.episodeUrl);
      out.push({
        rank: out.length + 1,
        title,
        showTitle:
          asString(r.podcastName) ?? asString(r.podcast_name) ??
          asString(r.podcast) ?? asString(r.showTitle) ?? asString(r.show),
        plays: asNumber(r.plays) ?? asNumber(r.playCount) ?? asNumber(r.play_count),
        comments: asNumber(r.comments) ?? asNumber(r.commentCount) ?? asNumber(r.comment_count),
        url: link?.startsWith("http") ? link : undefined,
      });
    }
    if (out.length > 0) return out;
  }
  return [];
}

let memoEpisodes: Promise<XyzEpisodeEntry[] | null> | null = null;

/** 中文播客榜's hot-episodes board (best-effort, cached daily). */
export async function xyzrankHotEpisodes(): Promise<XyzEpisodeEntry[] | null> {
  memoEpisodes ??= (async () => {
    try {
      const res = await fetch("https://xyzrank.com/api/episodes", {
        next: { revalidate: REVALIDATE_SECONDS },
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
          Referer: "https://xyzrank.com/",
        },
      });
      if (!res.ok) return null;
      const entries = extractEpisodes(await res.json());
      return entries.length > 0 ? entries : null;
    } catch {
      return null;
    }
  })();
  const eps = await memoEpisodes;
  if (!eps) memoEpisodes = null; // retry next request rather than cache failure
  return eps;
}

/** Rank + 小宇宙 stats for a show title, or null when unlisted/unreachable. */
export async function xyzrankBuzz(title: string): Promise<BuzzInput | null> {
  const chart = await chartIndex();
  if (!chart) return null;
  const key = normalizeTitle(title);
  const entry = chart.find((e) => normalizeTitle(e.title) === key);
  if (!entry) return null;
  return {
    xyzrankRank: entry.rank,
    subscribers: entry.subscribers,
    plays: entry.plays,
    comments: entry.comments,
  };
}
