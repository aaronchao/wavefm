import { buzzScore, type BuzzInput } from "./buzz";

/**
 * Rank a show's episodes — PURE. Free podcast APIs expose no per-episode
 * listen counts, so ranking is **discussion-first** where that signal is
 * available (Reddit threads / comments about the specific episode), then
 * rating, then objective proxies (recency, substantive duration). Each
 * result carries an honest `basis` naming what actually drove it, so the
 * UI never fakes a "most listened" number it can't know.
 */

export type EpisodeInput = {
  id: string;
  title: string;
  publishedAt?: string;
  durationSec?: number;
  /** Per-episode discussion counts, when gathered (else absent). */
  discussion?: BuzzInput;
  /** External rating 0..10, when known. */
  rating?: number;
};

export type EpisodeBasis = "discussion" | "rating" | "recent";

export type RankedEpisode = {
  episode: EpisodeInput;
  score: number;
  basis: EpisodeBasis;
  why: string;
};

const RECENCY_WEIGHT = 0.7;
const DURATION_WEIGHT = 0.3;
/** Sub-15-min items are usually trailers/teasers, not flagship episodes. */
const SHORT_SECONDS = 15 * 60;

function recencyScore(publishedAt: string | undefined, now: Date): number {
  if (!publishedAt || Number.isNaN(Date.parse(publishedAt))) return 0.3;
  const days = Math.max(0, (now.getTime() - Date.parse(publishedAt)) / 86_400_000);
  return days <= 30 ? 1 : days <= 180 ? 0.7 : days <= 365 ? 0.5 : 0.3;
}

function durationScore(durationSec: number | undefined): number {
  if (durationSec == null) return 0.6;
  return durationSec < SHORT_SECONDS ? 0.3 : 1;
}

function baseScore(e: EpisodeInput, now: Date): number {
  return (
    RECENCY_WEIGHT * recencyScore(e.publishedAt, now) +
    DURATION_WEIGHT * durationScore(e.durationSec)
  );
}

export type RankEpisodesOptions = { now?: Date; limit?: number };

export function rankEpisodes(
  episodes: EpisodeInput[],
  opts: RankEpisodesOptions = {},
): RankedEpisode[] {
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? 10;

  const ranked: RankedEpisode[] = episodes.map((episode) => {
    const buzz = buzzScore(episode.discussion);
    const rating = episode.rating != null ? episode.rating / 10 : null;
    const base = baseScore(episode, now);

    // discussion-first: a real discussion signal dominates; then rating;
    // otherwise fall back to the recency/duration proxy.
    let score: number;
    let basis: EpisodeBasis;
    if (buzz != null) {
      score = 1 + buzz + 0.2 * base; // +1 keeps discussed episodes above proxy-only
      basis = "discussion";
    } else if (rating != null) {
      score = 0.5 + rating + 0.2 * base;
      basis = "rating";
    } else {
      score = base;
      basis = "recent";
    }
    return { episode, score, basis, why: episodeWhy(episode, basis, now) };
  });

  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      a.episode.title.localeCompare(b.episode.title) ||
      a.episode.id.localeCompare(b.episode.id),
  );
  return ranked.slice(0, limit);
}

function episodeWhy(e: EpisodeInput, basis: EpisodeBasis, now: Date): string {
  if (basis === "discussion") {
    const posts = e.discussion?.redditPosts ?? 0;
    if (posts >= 3) return `Most discussed · ${posts} Reddit threads`;
    return "Most discussed";
  }
  if (basis === "rating") return `Highly rated · ${e.rating}`;
  if (e.publishedAt && !Number.isNaN(Date.parse(e.publishedAt))) {
    const days = Math.floor((now.getTime() - Date.parse(e.publishedAt)) / 86_400_000);
    if (days <= 7) return "New this week";
    if (days <= 30) return "Recent";
  }
  return "From the catalog";
}
