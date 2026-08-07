import { vibeOf, type Vibe } from "@/src/core/library/organize";

/**
 * "Right Now" — surfacing the right episode for the moment, with ZERO
 * manual filing (PURE: no React/Next/DB imports).
 *
 * Replaces the Inbox/Queue triage model. That model was triage debt: it
 * asked the user to do inbox-zero chores on a leisure app, so a big
 * collection rotted into an unusable wall either way. Anything requiring
 * per-episode curation would rot the same way, so nothing here asks the
 * user to file, rank, or tag.
 *
 * At listen time only two things about your context actually matter:
 *   • how long you've got  -> `durationSec`, already stored per episode
 *   • what headspace you're in -> `vibeOf()`, already derived from text
 * Both are computed from data the app already has, so this works instantly
 * on an existing library with no migration and no new user input.
 */

/** The minimal shape this module needs — a subset of SavedEpisode. */
export type NowEpisode = {
  episodeId: string;
  title: string;
  showTitle?: string;
  durationSec?: number;
  status: "queued" | "in_progress" | "finished";
  positionSec: number;
};

export type TimeBucket = {
  id: string;
  label: string;
  /**
   * Longest episode this slot accepts, in seconds — null means no limit.
   * Buckets are cumulative ("I have 30 minutes" happily accepts an 8-minute
   * episode), with a little headroom over the round number so a 32-minute
   * episode still counts as a "30 min" listen rather than being hidden by
   * a two-minute technicality.
   */
  maxSec: number | null;
};

export const TIME_BUCKETS: TimeBucket[] = [
  { id: "quick", label: "15 min", maxSec: 20 * 60 },
  { id: "short", label: "30 min", maxSec: 35 * 60 },
  { id: "hour", label: "1 hour", maxSec: 70 * 60 },
  { id: "any", label: "Any length", maxSec: null },
];

/** Seconds still to play — the resume point is what matters, not the total. */
export function remainingSec(e: NowEpisode): number | undefined {
  if (e.durationSec == null) return undefined;
  return Math.max(0, e.durationSec - (e.positionSec ?? 0));
}

/**
 * Does this episode fit the slot? Judged on time *remaining*, so a
 * half-finished 90-minute episode correctly shows up for a 45-minute slot.
 * Unknown duration always fits — better to offer it than to hide it.
 */
export function fitsTime(e: NowEpisode, bucket: TimeBucket): boolean {
  if (bucket.maxSec == null) return true;
  const left = remainingSec(e);
  return left == null || left <= bucket.maxSec;
}

/** The vibe of a saved episode, derived from its own + its show's title. */
export function vibeOfEpisode(e: NowEpisode): Vibe {
  return vibeOf({
    title: e.title,
    description: e.showTitle ?? "",
    categories: [],
  });
}

export type NowFilter = {
  bucket: TimeBucket;
  /** Vibe id to narrow to, or null for "anything". */
  vibeId?: string | null;
};

/**
 * Candidates for the moment, best first — the ordering *is* the
 * recommendation, so the UI can take [0] for "play something now" and walk
 * forward for "something else".
 *
 * Finished episodes drop out. Already-started ones lead: a half-listened
 * episode is the single strongest signal of what you actually wanted, and
 * resuming it clears the collection faster than starting something new.
 * Within each group the longest episode that still fits wins, so a
 * 28-minute pick beats a 5-minute one for a 30-minute slot rather than
 * leaving most of the slot unused.
 */
export function rankForNow(episodes: NowEpisode[], filter: NowFilter): NowEpisode[] {
  const pool = episodes.filter(
    (e) =>
      e.status !== "finished" &&
      fitsTime(e, filter.bucket) &&
      (!filter.vibeId || vibeOfEpisode(e).id === filter.vibeId),
  );
  return pool.sort((a, b) => {
    const started = Number(b.status === "in_progress") - Number(a.status === "in_progress");
    if (started !== 0) return started;
    // Unknown durations sort last — a known good fit beats a guess.
    const aLeft = remainingSec(a) ?? -1;
    const bLeft = remainingSec(b) ?? -1;
    if (aLeft !== bLeft) return bLeft - aLeft;
    return a.episodeId.localeCompare(b.episodeId); // stable tie-break
  });
}

/** The vibes actually present in a set of episodes, with their counts. */
export function vibesPresent(episodes: NowEpisode[]): { vibe: Vibe; count: number }[] {
  const counts = new Map<string, { vibe: Vibe; count: number }>();
  for (const e of episodes) {
    if (e.status === "finished") continue;
    const vibe = vibeOfEpisode(e);
    const hit = counts.get(vibe.id);
    if (hit) hit.count += 1;
    else counts.set(vibe.id, { vibe, count: 1 });
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.vibe.label.localeCompare(b.vibe.label),
  );
}
