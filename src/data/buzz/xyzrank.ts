import type { BuzzInput } from "@/src/core/recommend";
import { readXyzrankCache } from "@/src/data/repos/xyzrankCacheRepo";
import { normalizeForMatch } from "./match";

/**
 * 中文播客榜 (xyzrank.com) — free JSON API built on 小宇宙 + Apple data,
 * the same source xyzrank.com itself renders. The site's own four boards,
 * per its (now-archived) scraper's README — github.com/eddiehe99/xyzrank —
 * map straight onto its own tabs, each its own top-50-by-rank page
 * (confirmed live: `{items, total, offset, limit}`, `total` far exceeds
 * `items.length` — 50 is xyzrank's own board size, not an arbitrary cap):
 *   /api/podcasts       — 热门播客 (popular podcasts)
 *   /api/new-podcasts   — 新晋播客 (emerging podcasts)
 *   /api/episodes       — 热门单集 (hot episodes)
 *   /api/new-episodes   — 新晋单集 (rising episodes)
 *
 * Schema confirmed by fetching all four live (not guessed): podcast entries
 * carry `links` — apple/xyz(小宇宙)/rss URLs the show's own creator
 * submitted — so a show resolves to a real Apple id, feed, and cover
 * directly, with no fuzzy iTunes-search matching (and no risk of resolving
 * the wrong show) needed at all. Episode entries carry no links of their
 * own (only `podcastID`, joinable against the podcasts lists) but do carry
 * a direct 小宇宙 episode URL and the parent show's own logo/subscriber
 * count at ranking time.
 *
 * VERCEL IS BLOCKED: xyzrank sits behind Cloudflare bot protection that
 * blocks Vercel's outbound IPs specifically — confirmed by comparing an
 * identical request from a residential IP (200) against one proxied
 * through this app in production (blocked). Better headers don't fix this;
 * Cloudflare fingerprints below the HTTP layer. So every board-fetching
 * function here checks the `xyzrank_cache` table FIRST — populated by
 * scripts/ingest-xyzrank.ts, a scheduled GitHub Actions job running from a
 * non-Vercel IP — and only falls back to a live fetch (works in local dev,
 * and costs nothing to keep trying in case the block ever lifts) when the
 * cache is empty.
 */

const REVALIDATE_SECONDS = 24 * 60 * 60; // the ranking moves daily
const BOARD_SIZE = 50; // xyzrank's own board size per tab — see module doc
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
    const res = await fetch(`https://xyzrank.com${path}?limit=${BOARD_SIZE}`, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: BROWSER_HEADERS,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Find the first array of plausible entries — tolerates `{items:[...]}` or a bare array. */
function findEntries(json: unknown): unknown[] {
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
  return arrays.find((a) => a.length > 0) ?? [];
}

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

const normalizeTitle = normalizeForMatch;

/** A show's real links, as its own creator submitted them to xyzrank. */
export type XyzLinks = {
  apple?: string;
  xiaoyuzhou?: string;
  rss?: string;
};

function parseLinks(raw: unknown): XyzLinks {
  const out: XyzLinks = {};
  if (!Array.isArray(raw)) return out;
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const url = asString(r.url);
    if (!url) continue;
    if (r.name === "apple") out.apple = url;
    else if (r.name === "xyz") out.xiaoyuzhou = url;
    else if (r.name === "rss") out.rss = url;
  }
  return out;
}

/** One ranked show on a 中文播客榜 board (热门播客/新晋播客). */
export type XyzChartEntry = {
  /** xyzrank/小宇宙's own internal id — not an iTunes id. */
  id: string;
  rank: number;
  title: string;
  coverUrl?: string;
  author?: string;
  category?: string;
  episodeCount?: number;
  lastReleaseDaysAgo?: number;
  avgPlays?: number;
  avgComments?: number;
  avgDurationSec?: number;
  links: XyzLinks;
};

function parseChartEntry(raw: unknown, fallbackRank: number): XyzChartEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = asString(r.name);
  const id = asString(r.id);
  if (!title || !id) return null;
  const avgDuration = asNumber(r.avgDuration);
  return {
    id,
    rank: asNumber(r.rank) ?? fallbackRank,
    title,
    coverUrl: asString(r.logoURL),
    author: asString(r.authorsText),
    category: asString(r.primaryGenreName),
    episodeCount: asNumber(r.trackCount),
    lastReleaseDaysAgo: asNumber(r.lastReleaseDateDayCount),
    avgPlays: asNumber(r.avgPlayCount),
    avgComments: asNumber(r.avgCommentCount),
    avgDurationSec: avgDuration != null ? avgDuration * 60 : undefined,
    links: parseLinks(r.links),
  };
}

function extractCharts(json: unknown): XyzChartEntry[] {
  const out: XyzChartEntry[] = [];
  let i = 0;
  for (const raw of findEntries(json)) {
    i++;
    const e = parseChartEntry(raw, i);
    if (e) out.push(e);
  }
  return out;
}

async function fetchChart(path: string): Promise<XyzChartEntry[] | null> {
  const json = await fetchXyzJson(path);
  if (json === null) return null;
  const entries = extractCharts(json);
  return entries.length > 0 ? entries : null;
}

/** Live-only fetch, bypassing the Supabase cache — used only by the
 *  ingestion script (scripts/ingest-xyzrank.ts), which is what populates
 *  that cache in the first place. */
export async function xyzrankChartLive(): Promise<XyzChartEntry[] | null> {
  return fetchChart("/api/podcasts");
}

let memo: Promise<XyzChartEntry[] | null> | null = null;

async function chartIndex(): Promise<XyzChartEntry[] | null> {
  const cached = await readXyzrankCache<XyzChartEntry[]>("podcasts");
  if (cached) return cached;
  memo ??= fetchChart("/api/podcasts");
  const chart = await memo;
  if (!chart) memo = null; // retry next request rather than cache the failure
  return chart;
}

/** 热门播客 — the full 中文播客榜 leaderboard, ordered by rank. */
export async function xyzrankChart(): Promise<XyzChartEntry[] | null> {
  return chartIndex();
}

/** Live-only — see xyzrankChartLive's doc. */
export async function xyzrankNewPodcastsLive(): Promise<XyzChartEntry[] | null> {
  return fetchChart("/api/new-podcasts");
}

let memoNewPodcasts: Promise<XyzChartEntry[] | null> | null = null;

/** 新晋播客 — emerging shows climbing the board, ordered by rank. */
export async function xyzrankNewPodcasts(): Promise<XyzChartEntry[] | null> {
  const cached = await readXyzrankCache<XyzChartEntry[]>("new-podcasts");
  if (cached) return cached;
  memoNewPodcasts ??= fetchChart("/api/new-podcasts");
  const chart = await memoNewPodcasts;
  if (!chart) memoNewPodcasts = null;
  return chart;
}

/**
 * Both podcast boards, keyed by xyzrank's own show id — lets an episode
 * (which carries no links of its own, only `podcastID`) resolve its
 * parent's real apple/rss/小宇宙 links and cover without any fuzzy
 * title-matching, whenever that show also appears on either board.
 */
export async function xyzrankPodcastById(): Promise<Map<string, XyzChartEntry>> {
  const [chart, fresh] = await Promise.all([xyzrankChart(), xyzrankNewPodcasts()]);
  const byId = new Map<string, XyzChartEntry>();
  for (const e of [...(chart ?? []), ...(fresh ?? [])]) byId.set(e.id, e);
  return byId;
}

/** One ranked episode on a 中文播客榜 board (热门单集/新晋单集). */
export type XyzEpisodeEntry = {
  rank: number;
  title: string;
  showTitle?: string;
  /** Joins against XyzChartEntry.id on either podcast board — see xyzrankPodcastById. */
  podcastId?: string;
  coverUrl?: string;
  /** The episode's own 小宇宙 page. */
  url?: string;
  plays?: number;
  comments?: number;
  /** The parent show's subscriber count at ranking time. */
  subscribers?: number;
  durationSec?: number;
  publishedAt?: string;
};

function parseEpisodeEntry(raw: unknown, fallbackRank: number): XyzEpisodeEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = asString(r.title);
  if (!title) return null;
  const duration = asNumber(r.duration);
  return {
    rank: asNumber(r.rank) ?? fallbackRank,
    title,
    showTitle: asString(r.podcastName),
    podcastId: asString(r.podcastID),
    coverUrl: asString(r.logoURL),
    url: asString(r.link),
    plays: asNumber(r.playCount),
    comments: asNumber(r.commentCount),
    subscribers: asNumber(r.subscription),
    durationSec: duration != null ? duration * 60 : undefined,
    publishedAt: asString(r.postTime),
  };
}

function extractEpisodes(json: unknown): XyzEpisodeEntry[] {
  const out: XyzEpisodeEntry[] = [];
  let i = 0;
  for (const raw of findEntries(json)) {
    i++;
    const e = parseEpisodeEntry(raw, i);
    if (e) out.push(e);
  }
  return out;
}

async function fetchEpisodes(path: string): Promise<XyzEpisodeEntry[] | null> {
  const json = await fetchXyzJson(path);
  if (json === null) return null;
  const entries = extractEpisodes(json);
  return entries.length > 0 ? entries : null;
}

/** Live-only — see xyzrankChartLive's doc. */
export async function xyzrankHotEpisodesLive(): Promise<XyzEpisodeEntry[] | null> {
  return fetchEpisodes("/api/episodes");
}

let memoEpisodes: Promise<XyzEpisodeEntry[] | null> | null = null;

/** 热门单集 — 中文播客榜's hot-episodes board (best-effort, cached daily). */
export async function xyzrankHotEpisodes(): Promise<XyzEpisodeEntry[] | null> {
  const cached = await readXyzrankCache<XyzEpisodeEntry[]>("episodes");
  if (cached) return cached;
  memoEpisodes ??= fetchEpisodes("/api/episodes");
  const eps = await memoEpisodes;
  if (!eps) memoEpisodes = null; // retry next request rather than cache failure
  return eps;
}

/** Live-only — see xyzrankChartLive's doc. */
export async function xyzrankNewEpisodesLive(): Promise<XyzEpisodeEntry[] | null> {
  return fetchEpisodes("/api/new-episodes");
}

let memoNewEpisodes: Promise<XyzEpisodeEntry[] | null> | null = null;

/** 新晋单集 — rising episodes, ordered by rank. */
export async function xyzrankNewEpisodes(): Promise<XyzEpisodeEntry[] | null> {
  const cached = await readXyzrankCache<XyzEpisodeEntry[]>("new-episodes");
  if (cached) return cached;
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
    plays: entry.avgPlays,
    comments: entry.avgComments,
  };
}
