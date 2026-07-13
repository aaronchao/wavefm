/**
 * Quality-discussion ("buzz") signal — PURE. Raw counts come from free
 * sources gathered server-side (Reddit search, 中文播客榜/xyzrank built on
 * 小宇宙 + Apple data, Douban rating already flows via `rating`). Core
 * only normalizes; missing fields stay neutral, like every other metric.
 */

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

/**
 * 0..1 discussion-quality score, or null when nothing is known (so the
 * caller can skip the metric instead of punishing the unknown).
 */
export function buzzScore(b: BuzzInput | undefined): number | null {
  if (!b) return null;
  const parts: number[] = [];
  if (b.redditPosts != null) {
    // volume of threads, weighted up when they got real engagement
    const volume = logScale(b.redditPosts, 2); // 100 threads -> 1
    const traction = logScale((b.redditScore ?? 0) + (b.redditComments ?? 0), 4);
    parts.push(Math.min(1, 0.6 * volume + 0.4 * traction));
  }
  if (b.xyzrankRank != null) {
    parts.push(Math.max(0, 1 - (b.xyzrankRank - 1) / XYZRANK_SIZE));
  }
  if (b.subscribers != null) parts.push(logScale(b.subscribers, 6)); // 1M -> 1
  if (b.plays != null) parts.push(logScale(b.plays, 7));
  if (b.comments != null) parts.push(logScale(b.comments, 4));
  if (b.listenScore != null) {
    parts.push(Math.min(Math.max(b.listenScore, 0), 100) / 100);
  }
  if (parts.length === 0) return null;
  return parts.reduce((s, x) => s + x, 0) / parts.length;
}

/** Human phrase for the strongest buzz source, or null when unremarkable. */
export function buzzWhy(b: BuzzInput | undefined): string | null {
  if (!b) return null;
  if (b.xyzrankRank != null && b.xyzrankRank <= 50) {
    return `#${b.xyzrankRank} on 中文播客榜`;
  }
  if ((b.listenScore ?? 0) >= 60) {
    return `Popular podcast (Listen Score ${b.listenScore})`;
  }
  if ((b.redditPosts ?? 0) >= 5) {
    return `Talked about on Reddit (${b.redditPosts} threads)`;
  }
  if ((b.subscribers ?? 0) >= 10_000) {
    const k = Math.floor((b.subscribers ?? 0) / 1000);
    return `${k}k+ subscribers on 小宇宙`;
  }
  if ((b.comments ?? 0) >= 500) {
    return `Lively comments on 小宇宙`;
  }
  return null;
}
