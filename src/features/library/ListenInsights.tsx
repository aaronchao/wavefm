"use client";

import { useSyncExternalStore } from "react";
import { computeListenStats, type FinishedEpisode } from "@/src/core/library/listenStats";

// Date.now() can't be called directly during render (react-hooks/purity), and
// setting it from an effect trips the separate no-cascading-setState rule.
// useSyncExternalStore's getSnapshot is the sanctioned escape hatch for
// reading an external, non-React value like the clock.
//
// BUG THIS FIXES: getSnapshot must return a STABLE reference between calls
// unless the external store genuinely changed — passing `Date.now` directly
// violates that (every call returns a new value), so React saw a "changed"
// snapshot on every single render check and re-rendered forever ("Maximum
// update depth exceeded", caught by the nearest error boundary — the whole
// component silently died). Caching the value after the first read restores
// the actual intent: read "now" once, at mount, and hold it.
const noSubscription = () => () => {};
let cachedNow: number | null = null;
function getNow(): number {
  if (cachedNow === null) cachedNow = Date.now();
  return cachedNow;
}
function useNow(): number {
  return useSyncExternalStore(noSubscription, getNow, () => 0);
}

/**
 * A small "what have I actually been listening to" strip above History —
 * the answer to row 9's queued "listening stats view", and to Aaron's own
 * "help me understand more about myself" ask. Four figures plus a 6-week
 * activity strip, all derived from finished episodes already on hand — no
 * new data, no separate page, just reading what's already there differently.
 */

function formatDuration(totalSec: number): string {
  if (totalSec <= 0) return "0m";
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.round((totalSec % 3600) / 60);
  if (hours === 0) return `${mins}m`;
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours > 0 ? `${days}d ${restHours}h` : `${days}d`;
}

export function ListenInsights({ finished }: { finished: FinishedEpisode[] }) {
  const now = useNow();
  if (finished.length === 0 || now === 0) return null;
  const stats = computeListenStats(finished, now);

  return (
    <div className="flex flex-col gap-3 rounded-[2px] border border-dashed border-surface-border px-3 py-3">
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
        <Stat value={String(stats.totalFinished)} label={stats.totalFinished === 1 ? "episode" : "episodes"} />
        <Stat value={formatDuration(stats.totalSeconds)} label="listened" />
        <Stat
          value={String(stats.streakDays)}
          label={stats.streakDays === 1 ? "day streak" : "day streak"}
        />
        {stats.topShow && (
          <Stat value={String(stats.topShow.count)} label={`from ${stats.topShow.showTitle}`} />
        )}
      </div>
      <ActivityStrip activity={stats.activity} />
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="font-brand text-sm font-bold tabular-nums text-zinc-800 dark:text-zinc-100">
        {value}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

/** 6 weeks of little squares, faint to bright by how much got finished that
 *  day — a GitHub-contributions read, in the app's own dot-matrix idiom. */
function ActivityStrip({ activity }: { activity: { date: string; count: number }[] }) {
  return (
    <div className="flex flex-wrap gap-[3px]" role="img" aria-label="Finishes over the last 6 weeks">
      {activity.map((d) => (
        <span
          key={d.date}
          title={`${d.date}: ${d.count} finished`}
          className="h-2 w-2 shrink-0 rounded-[1px]"
          style={{
            backgroundColor:
              d.count === 0
                ? "rgba(148, 148, 148, 0.18)"
                : d.count === 1
                  ? "rgba(255, 59, 48, 0.45)"
                  : "rgba(255, 59, 48, 0.9)",
          }}
        />
      ))}
    </div>
  );
}
