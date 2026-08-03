/**
 * gpodder.net progress-sync (REFINEMENTS.md #3, "External player progress
 * sync"): the pure matching/decision piece of a one-shot pull sync. Given
 * the "play" actions gpodder.net reports and the user's saved episodes,
 * decide which saved episodes to update and whether the reported position
 * counts as "finished". PURE: no I/O, no React/Next imports — the actual
 * HTTP calls live in src/data/sync/gpodder.ts.
 */

export type GpodderAction = {
  /** The episode's enclosure/audio URL — how gpodder.net actions are matched to `SavedEpisode.audioUrl`. */
  audioUrl: string;
  positionSec: number;
  totalSec?: number;
};

/** Minimal shape of a saved episode needed to match against gpodder actions. */
export type MatchableEpisode = {
  episodeId: string;
  audioUrl?: string;
};

export type GpodderProgressUpdate = {
  episodeId: string;
  status: "in_progress" | "finished";
  positionSec: number;
};

/** A position at or above this fraction of the total counts as "finished" — mirrors the manual finished-toggle threshold used elsewhere in the Library. */
const FINISHED_FRACTION = 0.9;

export function statusForGpodderPosition(
  positionSec: number,
  totalSec: number | undefined,
): "in_progress" | "finished" {
  if (totalSec != null && totalSec > 0 && positionSec >= totalSec * FINISHED_FRACTION) {
    return "finished";
  }
  return "in_progress";
}

/**
 * Matches gpodder.net "play" actions to saved episodes by exact audio-URL
 * equality, and decides the resulting status per matched episode. Later
 * actions for the same episode win (gpodder.net's `actions` array is
 * chronological, oldest first) so the caller gets the most recent position.
 */
export function matchGpodderActions(
  actions: GpodderAction[],
  episodes: MatchableEpisode[],
): GpodderProgressUpdate[] {
  const byUrl = new Map<string, GpodderAction>();
  for (const action of actions) {
    if (!action.audioUrl) continue;
    byUrl.set(action.audioUrl, action); // last write wins -> most recent action per URL
  }

  const updates: GpodderProgressUpdate[] = [];
  for (const episode of episodes) {
    if (!episode.audioUrl) continue;
    const action = byUrl.get(episode.audioUrl);
    if (!action) continue;
    updates.push({
      episodeId: episode.episodeId,
      status: statusForGpodderPosition(action.positionSec, action.totalSec),
      positionSec: action.positionSec,
    });
  }
  return updates;
}
