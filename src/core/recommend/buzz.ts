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
  /** V2EX threads mentioning the show (niche zh tech/interest community). */
  v2exMentions?: number;
  /** Dcard posts mentioning the show (Taiwanese social forum). */
  dcardMentions?: number;
  /** PTT (批踢踢) posts mentioning the show. */
  pttMentions?: number;
  /** LIHKG (連登) threads mentioning the show. */
  lihkgMentions?: number;
  /** 豆瓣小组 topics mentioning the show. */
  doubanMentions?: number;
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
/** Real human-discussion signals (Reddit / V2EX threads, 小宇宙 comments). */
function discussionParts(b: BuzzInput): number[] {
  const discussion: number[] = [];
  if (b.redditPosts != null) {
    // volume of threads, weighted up when they got real engagement
    const volume = logScale(b.redditPosts, 2); // 100 threads -> 1
    const traction = logScale((b.redditScore ?? 0) + (b.redditComments ?? 0), 4);
    discussion.push(Math.min(1, 0.6 * volume + 0.4 * traction));
  }
  if (b.v2exMentions != null) discussion.push(logScale(b.v2exMentions, 1.5)); // ~30 threads -> 1
  if (b.dcardMentions != null) discussion.push(logScale(b.dcardMentions, 1.5));
  if (b.pttMentions != null) discussion.push(logScale(b.pttMentions, 1.5));
  if (b.lihkgMentions != null) discussion.push(logScale(b.lihkgMentions, 1.5));
  if (b.doubanMentions != null) discussion.push(logScale(b.doubanMentions, 1.5));
  if (b.comments != null) discussion.push(logScale(b.comments, 4)); // 小宇宙 comments
  return discussion;
}

/** Raw popularity signals (charts, subscribers, plays, Listen Score). */
function popularityParts(b: BuzzInput): number[] {
  const popularity: number[] = [];
  if (b.xyzrankRank != null) {
    popularity.push(Math.max(0, 1 - (b.xyzrankRank - 1) / XYZRANK_SIZE));
  }
  if (b.subscribers != null) popularity.push(logScale(b.subscribers, 6)); // 1M -> 1
  if (b.plays != null) popularity.push(logScale(b.plays, 7));
  if (b.listenScore != null) {
    popularity.push(Math.min(Math.max(b.listenScore, 0), 100) / 100);
  }
  return popularity;
}

export function buzzScore(b: BuzzInput | undefined): number | null {
  if (!b) return null;
  const discussion = discussionParts(b);
  const popularity = popularityParts(b);
  const d = discussion.length ? avg(discussion) : null;
  const p = popularity.length ? avg(popularity) : null;
  if (d == null && p == null) return null;
  if (d == null) return p;
  if (p == null) return d;
  return WEIGHTS.buzzDiscussion * d + WEIGHTS.buzzPopularity * p;
}

/**
 * Human-discussion score ONLY (0..1), ignoring raw popularity — the signal
 * Wavr ranks by: what communities actually talk about. Null when no
 * discussion source is present (so callers can require real chatter).
 */
export function discussionScore(b: BuzzInput | undefined): number | null {
  if (!b) return null;
  const d = discussionParts(b);
  return d.length ? avg(d) : null;
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
  if ((b.v2exMentions ?? 0) >= 3) {
    return `Discussed on V2EX (${b.v2exMentions} threads)`;
  }
  if ((b.dcardMentions ?? 0) >= 3) {
    return `Discussed on Dcard (${b.dcardMentions} posts)`;
  }
  if ((b.doubanMentions ?? 0) >= 3) {
    return `聊过 on 豆瓣小组 (${b.doubanMentions} topics)`;
  }
  if ((b.pttMentions ?? 0) >= 3) {
    return `Discussed on PTT (${b.pttMentions} posts)`;
  }
  if ((b.lihkgMentions ?? 0) >= 3) {
    return `熱議 on LIHKG (${b.lihkgMentions} threads)`;
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
