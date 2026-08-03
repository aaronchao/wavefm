import type { BuzzInput } from "@/src/core/recommend";
import { normalizeForMatch } from "./match";

/**
 * 中文播客榜 (xyzrank.com) — free JSON API built on 小宇宙 + Apple data,
 * the same source xyzrank.com itself renders. One cached fetch per endpoint
 * serves every lookup; any failure returns null and the signal is skipped.
 * The site's own four boards, per its (now-archived) scraper's README —
 * github.com/eddiehe99/xyzrank — map straight onto its own tabs:
 *   /api/podcasts       — 热门播客 (popular podcasts)
 *   /api/new-podcasts   — 新晋播客 (emerging podcasts)
 *   /api/episodes       — 热门单集 (hot episodes)
 *   /api/new-episodes   — 新晋单集 (rising episodes)
 */

const REVALIDATE_SECONDS = 24 * 60 * 60; // the ranking moves daily
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  Referer: "https://xyzrank.com/",
};

/**
 * xyzrank sits behind a bot filter that 403s bare server-side fetches;
 * these browser-like headers get us the JSON, but it's still best-effort —
 * any failure just returns null so a board falls back to its own backbone.
 */
async function fetchXyzJson(path: string): Promise<unknown | null> {
  try {
    const res = await fetch(`https://xyzrank.com${path}`, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: BROWSER_HEADERS,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

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

async function fetchChart(path: string): Promise<XyzChartEntry[] | null> {
  const json = await fetchXyzJson(path);
  if (json === null) return null;
  const entries = extractOrdered(json);
  return entries.length > 0 ? entries : null;
}

let memo: Promise<XyzChartEntry[] | null> | null = null;

async function chartIndex(): Promise<XyzChartEntry[] | null> {
  memo ??= fetchChart("/api/podcasts");
  const chart = await memo;
  if (!chart) memo = null; // retry next request rather than cache the failure
  return chart;
}

/** The full 中文播客榜 leaderboard, ordered by rank (for Chinese discovery). */
export async function xyzrankChart(): Promise<XyzChartEntry[] | null> {
  return chartIndex();
}

let memoNewPodcasts: Promise<XyzChartEntry[] | null> | null = null;

/** 新晋播客 — emerging shows climbing the board, ordered by rank. */
export async function xyzrankNewPodcasts(): Promise<XyzChartEntry[] | null> {
  memoNewPodcasts ??= fetchChart("/api/new-podcasts");
  const chart = await memoNewPodcasts;
  if (!chart) memoNewPodcasts = null;
  return chart;
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

async function fetchEpisodes(path: string): Promise<XyzEpisodeEntry[] | null> {
  const json = await fetchXyzJson(path);
  if (json === null) return null;
  const entries = extractEpisodes(json);
  return entries.length > 0 ? entries : null;
}

let memoEpisodes: Promise<XyzEpisodeEntry[] | null> | null = null;

/** 热门单集 — 中文播客榜's hot-episodes board (best-effort, cached daily). */
export async function xyzrankHotEpisodes(): Promise<XyzEpisodeEntry[] | null> {
  memoEpisodes ??= fetchEpisodes("/api/episodes");
  const eps = await memoEpisodes;
  if (!eps) memoEpisodes = null; // retry next request rather than cache failure
  return eps;
}

let memoNewEpisodes: Promise<XyzEpisodeEntry[] | null> | null = null;

/** 新晋单集 — rising episodes, ordered by rank. */
export async function xyzrankNewEpisodes(): Promise<XyzEpisodeEntry[] | null> {
  memoNewEpisodes ??= fetchEpisodes("/api/new-episodes");
  const eps = await memoNewEpisodes;
  if (!eps) memoNewEpisodes = null;
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
