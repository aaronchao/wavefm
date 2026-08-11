"use client";

import {
  setEpisodeBucket,
  updateEpisodeProgress,
  type SavedEpisode,
} from "@/src/data/repos/savedEpisodesRepo";

/**
 * What's out of the queue, and why.
 *
 * Both `archived` (dismissed) and `finished` (listened) episodes read straight
 * off the synced `saved_episodes` rows passed in from the Library page —
 * `bucket`/`status`/`updated_at` all sync across devices already, so an
 * episode finished on the phone (by hand, or via Pocket Casts) shows up here
 * on the laptop too, with no separate local-only log to keep in step.
 *
 * Finished episodes are grouped by day — a running record of what got
 * listened to and when, not just a flat "recently done" list.
 */

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** Splits an already-sorted (newest-first) list into consecutive same-day runs. */
function groupByDay(items: SavedEpisode[]): { label: string; items: SavedEpisode[] }[] {
  const groups: { label: string; items: SavedEpisode[] }[] = [];
  for (const e of items) {
    const label = dayLabel(e.updatedAt);
    const current = groups[groups.length - 1];
    if (current && current.label === label) current.items.push(e);
    else groups.push({ label, items: [e] });
  }
  return groups;
}

export function ListenHistory({
  archived = [],
  finished = [],
  onChanged,
}: {
  /** Episodes explicitly set aside (the ✕ "not interested" action). */
  archived?: SavedEpisode[];
  /** Episodes marked finished — manual tick, Pocket Casts sync, or
   *  auto-retire — newest (`updatedAt`) first. */
  finished?: SavedEpisode[];
  onChanged?: () => void;
}) {
  if (archived.length === 0 && finished.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Nothing here yet — finish an episode or archive one and it shows up here.
      </p>
    );
  }

  const groups = groupByDay(finished);

  return (
    <div className="flex flex-col gap-4">
      {archived.length > 0 && (
        <ul className="flex flex-col gap-2">
          {archived.map((e) => (
            <HistoryRow
              key={e.episodeId}
              episode={e}
              reason="archived"
              onRestore={() => {
                void setEpisodeBucket(e.episodeId, "queue", 0).then(() => onChanged?.());
              }}
            />
          ))}
        </ul>
      )}
      {groups.map((g) => (
        <div key={g.label} className="flex flex-col gap-2">
          <p className="font-brand text-[11px] uppercase tracking-wider text-muted-foreground">
            {g.label}
          </p>
          <ul className="flex flex-col gap-2">
            {g.items.map((e) => (
              <HistoryRow
                key={e.episodeId}
                episode={e}
                reason={e.finishedInferred ? "assumed finished" : "finished"}
                time={formatTime(e.updatedAt)}
                onRestore={() => {
                  void updateEpisodeProgress(e.episodeId, { status: "queued" }).then(() =>
                    onChanged?.(),
                  );
                }}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function HistoryRow({
  episode,
  reason,
  time,
  onRestore,
}: {
  episode: SavedEpisode;
  reason: string;
  /** Time-of-day, shown for finished rows (the day is already the group header). */
  time?: string;
  onRestore: () => void;
}) {
  return (
    <li className="flex items-center gap-3">
      {episode.coverUrl ? (
        // arbitrary external art hosts; skip Vercel image optimization
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={episode.coverUrl}
          alt=""
          loading="lazy"
          className="h-9 w-9 shrink-0 rounded-tile object-cover"
        />
      ) : (
        <div className="h-9 w-9 shrink-0 rounded-tile bg-surface" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{episode.title}</p>
        <p className="truncate text-xs text-zinc-500">
          {episode.showTitle ? `${episode.showTitle} · ` : ""}
          {reason}
          {time ? ` · ${time}` : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={onRestore}
        className="font-brand shrink-0 rounded-[2px] border border-surface-border px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        Restore
      </button>
    </li>
  );
}
