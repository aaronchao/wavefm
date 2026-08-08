import { normalizeAudioUrl } from "@/src/core/appleEpisode";

/**
 * Pocket Casts progress-sync: the pure matching/decision piece. PURE — the
 * HTTP calls live in the /api/sync/pocketcasts route.
 *
 * This is the accurate half of the listen-status fix. Auto-retire
 * (src/core/library/autoRetire.ts) only ever *guesses* from elapsed time,
 * because Pocket Casts doesn't speak gpodder.net and has no public API. Its
 * private API does report real played status, so where this is available it
 * should win outright — a fact beats an inference.
 *
 * Matching is on the audio enclosure URL, normalised. Pocket Casts serves
 * its own copy of a feed's URL and the two routinely differ by redirect
 * wrappers (podtrac, pscrb) and tracking query strings, so raw equality —
 * which is all the gpodder matcher needs — would miss most rows here.
 */

/** Pocket Casts' own status codes, from the history payload. */
export const PC_UNPLAYED = 1;
export const PC_PLAYING = 2;
export const PC_PLAYED = 3;

export type PocketCastsEpisode = {
  /** Enclosure URL as Pocket Casts holds it. */
  url?: string;
  /** 1 unplayed | 2 in progress | 3 played. */
  playingStatus?: number;
  /** Seconds played so far. */
  playedUpTo?: number;
  duration?: number;
};

/** A subscribed podcast from Pocket Casts' own list. */
export type PocketCastsPodcast = {
  uuid?: string;
  title?: string;
  author?: string;
  /** Their web page for the show. */
  url?: string;
  /** The RSS feed — the only field that reliably identifies a show for us. */
  feedUrl?: string;
};

/** A show already in the library, for deciding what's genuinely new. */
export type MatchableShow = {
  feedUrl?: string;
  title?: string;
};

export type NewSubscription = {
  title: string;
  feedUrl: string;
  author?: string;
};

/**
 * Subscriptions in Pocket Casts that aren't in the library yet.
 *
 * ADDITIVE AND ONE-WAY, deliberately: this never reports removals, so
 * unsubscribing in Pocket Casts can't delete a saved show here. "Saved in
 * WaveFM" and "subscribed in Pocket Casts" aren't the same statement, and
 * silently deleting a library on the say-so of an unofficial API is the
 * kind of bug that's unforgivable when it misfires.
 *
 * Matched on feed URL — titles drift and get localised, whereas the feed is
 * the show's actual identity. Anything without one is skipped rather than
 * guessed at.
 */
export function newSubscriptions(
  podcasts: PocketCastsPodcast[],
  existing: MatchableShow[],
): NewSubscription[] {
  const have = new Set(
    existing
      .map((s) => s.feedUrl)
      .filter((u): u is string => Boolean(u))
      .map((u) => normalizeAudioUrl(u)),
  );
  const seen = new Set<string>();
  const out: NewSubscription[] = [];
  for (const p of podcasts) {
    if (!p.feedUrl || !p.title) continue;
    const key = normalizeAudioUrl(p.feedUrl);
    if (have.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({ title: p.title, feedUrl: p.feedUrl, author: p.author });
  }
  return out;
}

export type MatchableEpisode = {
  episodeId: string;
  audioUrl?: string;
};

export type ProgressUpdate = {
  episodeId: string;
  status: "in_progress" | "finished";
  positionSec: number;
};

/**
 * Pocket Casts marks an episode played explicitly, so its own flag is
 * authoritative and there's no need to guess from a position fraction the
 * way the gpodder matcher has to. A position without the played flag is
 * genuinely just progress.
 */
export function statusForPocketCasts(ep: PocketCastsEpisode): "in_progress" | "finished" | null {
  if (ep.playingStatus === PC_PLAYED) return "finished";
  if (ep.playingStatus === PC_PLAYING && (ep.playedUpTo ?? 0) > 0) return "in_progress";
  return null; // unplayed, or nothing useful reported — leave the row alone
}

/**
 * Matches Pocket Casts history to saved episodes and decides each status.
 * Only episodes we actually hold are returned; the history covers the whole
 * Pocket Casts account, most of which WaveFM knows nothing about.
 */
export function matchPocketCastsHistory(
  history: PocketCastsEpisode[],
  episodes: MatchableEpisode[],
): ProgressUpdate[] {
  const byUrl = new Map<string, PocketCastsEpisode>();
  for (const ep of history) {
    if (!ep.url) continue;
    byUrl.set(normalizeAudioUrl(ep.url), ep);
  }

  const updates: ProgressUpdate[] = [];
  for (const episode of episodes) {
    if (!episode.audioUrl) continue;
    const hit = byUrl.get(normalizeAudioUrl(episode.audioUrl));
    if (!hit) continue;
    const status = statusForPocketCasts(hit);
    if (!status) continue;
    updates.push({
      episodeId: episode.episodeId,
      status,
      positionSec: Math.max(0, Math.round(hit.playedUpTo ?? 0)),
    });
  }
  return updates;
}
