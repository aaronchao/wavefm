/**
 * Quality-discussion ("buzz") signal — PURE. Raw counts come from free
 * sources gathered server-side (Reddit search, 中文播客榜/xyzrank built on
 * 小宇宙 + Apple data, Douban rating already flows via `rating`). Core
 * only normalizes; missing fields stay neutral, like every other metric.
 */

import { WEIGHTS } from "./weights";

export type BuzzInput = {
  /** Reddit threads mentioning the show + their vote/comment volume. */
  redditPosts?: number;
  redditScore?: number;
  redditComments?: number;
  /** 1-based rank on 中文播客榜 (xyzrank) popular podcasts. */
  xyzrankRank?: number;
  /** 小宇宙 stats, when available (xyzrank payloads or env-gated API). */
  subscribers?: number;
  plays?: number;
  comments?: number;
  /** Listen Notes' Listen Score: 0–100 global popularity percentile. */
  listenScore?: number;
};

const XYZRANK_SIZE = 200;

function logScale(n: number, digitsForFull: number): number {
  return Math.min(1, Math.log10(n + 1) / digitsForFull);
}

const avg = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;

/**
 * 0..1 quality score, discussion-first: real human discussion (Reddit
 * threads, 小宇宙 comments) is weighted well above raw popularity
 * (subscribers, plays, charts, Listen Score). Null when nothing is known.
 * When only one side is present it stands alone (no unknown penalty).
 */
export function buzzScore(b: BuzzInput | undefined): number | null {
  if (!b) return null;
  const discussion: number[] = [];
  const popularity: number[] = [];

  if (b.redditPosts != null) {
    // volume of threads, weighted up when they got real engagement
    const volume = logScale(b.redditPosts, 2); // 100 threads -> 1
    const traction = logScale((b.redditScore ?? 0) + (b.redditComments ?? 0), 4);
    discussion.push(Math.min(1, 0.6 * volume + 0.4 * traction));
  }
  if (b.comments != null) discussion.push(logScale(b.comments, 4)); // 小宇宙 comments

  if (b.xyzrankRank != null) {
    popularity.push(Math.max(0, 1 - (b.xyzrankRank - 1) / XYZRANK_SIZE));
  }
  if (b.subscribers != null) popularity.push(logScale(b.subscribers, 6)); // 1M -> 1
  if (b.plays != null) popularity.push(logScale(b.plays, 7));
  if (b.listenScore != null) {
    popularity.push(Math.min(Math.max(b.listenScore, 0), 100) / 100);
  }

  const d = discussion.length ? avg(discussion) : null;
  const p = popularity.length ? avg(popularity) : null;
  if (d == null && p == null) return null;
  if (d == null) return p;
  if (p == null) return d;
  return WEIGHTS.buzzDiscussion * d + WEIGHTS.buzzPopularity * p;
}

/**
 * Human phrase for the buzz — human-discussion sources lead, popularity
 * sources follow. Null when nothing is remarkable.
 */
export function buzzWhy(b: BuzzInput | undefined): string | null {
  if (!b) return null;
  if ((b.redditPosts ?? 0) >= 5) {
    return `Talked about on Reddit (${b.redditPosts} threads)`;
  }
  if ((b.comments ?? 0) >= 500) {
    return `Lively comments on 小宇宙`;
  }
  if (b.xyzrankRank != null && b.xyzrankRank <= 50) {
    return `#${b.xyzrankRank} on 中文播客榜`;
  }
  if ((b.listenScore ?? 0) >= 60) {
    return `Popular podcast (Listen Score ${b.listenScore})`;
  }
  if ((b.subscribers ?? 0) >= 10_000) {
    const k = Math.floor((b.subscribers ?? 0) / 1000);
    return `${k}k+ subscribers on 小宇宙`;
  }
  return null;
}
