/**
 * Listening insights, derived entirely from finished episodes (PURE).
 *
 * WaveFM can't observe playback in an external player, so "listening time"
 * here is the sum of finished episodes' own `durationSec` — a real proxy
 * (you did finish it), not a literal measured-seconds-played number. Same
 * honesty rule as `finishedInferred` elsewhere: these are estimates from
 * what's on hand, not a claim of precision measurement.
 */

export type FinishedEpisode = {
  episodeId: string;
  showTitle?: string;
  durationSec?: number;
  /** When it was marked finished (SavedEpisode.updatedAt). */
  updatedAt: string;
};

export type ShowTally = { showTitle: string; count: number };

export type DayActivity = { date: string; count: number };

export type ListenStats = {
  totalFinished: number;
  totalSeconds: number;
  /** Consecutive days up to and including `now`, or the most recent
   *  finish if today has none yet — 0 once a day is fully missed. */
  streakDays: number;
  topShow: ShowTally | null;
  /** One entry per day, oldest first, covering the trailing `days` window. */
  activity: DayActivity[];
};

function dateKey(iso: string): string {
  const d = new Date(iso);
  // en-CA gives YYYY-MM-DD directly — a sortable, comparable key with no
  // manual zero-padding.
  return d.toLocaleDateString("en-CA");
}

/** Total time across every finished episode with a known duration. */
export function totalListenedSeconds(episodes: FinishedEpisode[]): number {
  return episodes.reduce((sum, e) => sum + (e.durationSec ?? 0), 0);
}

/** The show with the most finishes; null when there are none (or all untitled). */
export function topShow(episodes: FinishedEpisode[]): ShowTally | null {
  const counts = new Map<string, number>();
  for (const e of episodes) {
    if (!e.showTitle) continue;
    counts.set(e.showTitle, (counts.get(e.showTitle) ?? 0) + 1);
  }
  let best: ShowTally | null = null;
  for (const [showTitle, count] of counts) {
    if (!best || count > best.count) best = { showTitle, count };
  }
  return best;
}

/**
 * Consecutive days with at least one finish, walking backward from `now`.
 * A day with nothing breaks the streak — EXCEPT today itself, which simply
 * hasn't happened yet rather than counting as a miss (you can still finish
 * something later today).
 */
export function currentStreakDays(episodes: FinishedEpisode[], now: number): number {
  if (episodes.length === 0) return 0;
  const days = new Set(episodes.map((e) => dateKey(e.updatedAt)));
  let streak = 0;
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  // Today counts if it has a finish, but an empty today doesn't break a
  // streak that's still active from yesterday backward.
  if (days.has(cursor.toLocaleDateString("en-CA"))) streak++;
  cursor.setDate(cursor.getDate() - 1);
  while (days.has(cursor.toLocaleDateString("en-CA"))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** One count per day for the trailing `days` window, oldest first. */
export function activityByDay(
  episodes: FinishedEpisode[],
  now: number,
  days = 42,
): DayActivity[] {
  const counts = new Map<string, number>();
  for (const e of episodes) {
    const key = dateKey(e.updatedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const out: DayActivity[] = [];
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const key = cursor.toLocaleDateString("en-CA");
    out.push({ date: key, count: counts.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export function computeListenStats(episodes: FinishedEpisode[], now: number): ListenStats {
  return {
    totalFinished: episodes.length,
    totalSeconds: totalListenedSeconds(episodes),
    streakDays: currentStreakDays(episodes, now),
    topShow: topShow(episodes),
    activity: activityByDay(episodes, now),
  };
}
