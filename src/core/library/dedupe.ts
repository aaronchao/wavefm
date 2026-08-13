import { normalizeAudioUrl, titleKey } from "@/src/core/appleEpisode";

/**
 * Finding real duplicate saved episodes — same underlying episode, saved
 * under two different `episodeId`s (PURE). `saveEpisode` already dedupes on
 * exact id match, but the same episode can arrive through the catalog
 * search, a Wavr card, an RSS/OPML import, and Pocket Casts sync, each
 * minting its own id scheme (iTunes numeric id, `rss-<hash>`, etc.) — those
 * never collide on id, so real duplicate rows still land.
 *
 * Identity is the same signal `pocketCastsMatch`/`gpodderMatch` already use
 * for the same reason (matching an unofficial API's own id scheme against
 * ours): the normalised audio-enclosure URL when known — the one fact that
 * can't lie about "is this literally the same file" — falling back to
 * show + loose title when a row has no audio URL at all.
 */

export type DedupableEpisode = {
  episodeId: string;
  showId?: string;
  title: string;
  audioUrl?: string;
  status: "queued" | "in_progress" | "finished";
  updatedAt: string;
};

function identityKey(e: DedupableEpisode): string {
  if (e.audioUrl) return `audio:${normalizeAudioUrl(e.audioUrl)}`;
  return `title:${(e.showId ?? "").toLowerCase()}::${titleKey(e.title)}`;
}

/** Groups of 2+ rows that are really the same episode, keyed by identity. */
export function findDuplicateGroups<T extends DedupableEpisode>(episodes: T[]): T[][] {
  const byKey = new Map<string, T[]>();
  for (const e of episodes) {
    const key = identityKey(e);
    const group = byKey.get(key);
    if (group) group.push(e);
    else byKey.set(key, [e]);
  }
  return Array.from(byKey.values()).filter((g) => g.length > 1);
}

/**
 * Which one to keep from a duplicate group: real progress/completion beats
 * a row nobody has touched yet, then most recently updated — never an
 * arbitrary "first in the array", so re-running this is deterministic.
 */
export function pickKeeper<T extends DedupableEpisode>(group: T[]): T {
  return [...group].sort((a, b) => {
    const engaged = Number(b.status !== "queued") - Number(a.status !== "queued");
    if (engaged !== 0) return engaged;
    return b.updatedAt.localeCompare(a.updatedAt);
  })[0];
}

/** episodeIds of every duplicate EXCEPT the one worth keeping, across all groups. */
export function episodeIdsToRemove<T extends DedupableEpisode>(episodes: T[]): string[] {
  const out: string[] = [];
  for (const group of findDuplicateGroups(episodes)) {
    const keep = pickKeeper(group).episodeId;
    for (const e of group) if (e.episodeId !== keep) out.push(e.episodeId);
  }
  return out;
}
