"use client";

import { useSyncExternalStore } from "react";
import { clearHistory, listHistory, type HistoryEntry } from "@/src/data/repos/listenHistoryRepo";
import { setEpisodeBucket, type SavedEpisode } from "@/src/data/repos/savedEpisodesRepo";

/**
 * What you've actually sent off to listen to.
 *
 * Playback happens in someone else's app, so without this WaveFM has no
 * answer to "did I already deal with this?" — the gap that made the queue
 * feel untrustworthy and the retiring feel like magic. Showing the log makes
 * auto-retire legible: you can see what it decided and, importantly, that it
 * decided rather than knew (`inferred`).
 */

const listeners = new Set<() => void>();
const EMPTY: HistoryEntry[] = [];
// Cached so getSnapshot returns a stable reference between renders —
// useSyncExternalStore re-renders forever if it sees a new array each call.
let cache: HistoryEntry[] | null = null;

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): HistoryEntry[] {
  if (cache === null) cache = listHistory();
  return cache;
}

export function refreshHistory(): void {
  cache = null;
  for (const l of listeners) l();
}

/**
 * Absolute, formatted from the entry's own timestamp. A relative "2h ago"
 * would need Date.now() during render — impure, and it would also disagree
 * between the server's clock and the browser's on a prerendered page.
 */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ListenHistory({
  archived = [],
  onChanged,
}: {
  /** Episodes explicitly set aside. Merged in here rather than given their
   *  own section: "archived" and "finished" are different mechanics but the
   *  same user-facing fact — it's out of the queue. */
  archived?: SavedEpisode[];
  onChanged?: () => void;
}) {
  const entries = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);

  if (entries.length === 0 && archived.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Nothing handed off yet. Open an episode in Apple, Spotify or Pocket Casts and it shows up
        here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {archived.length > 0 && (
        <ul className="flex flex-col gap-2">
          {archived.map((e) => (
            <li key={e.episodeId} className="flex items-center gap-3">
              {e.coverUrl ? (
                // arbitrary external art hosts; skip Vercel image optimization
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.coverUrl} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-tile object-cover" />
              ) : (
                <div className="h-9 w-9 shrink-0 rounded-tile bg-surface" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{e.title}</p>
                <p className="truncate text-xs text-zinc-500">
                  {e.showTitle ? `${e.showTitle} · ` : ""}archived
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void setEpisodeBucket(e.episodeId, "queue", 0).then(() => onChanged?.());
                }}
                className="font-brand shrink-0 rounded-[2px] border border-surface-border px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}
      <ul className="flex flex-col gap-2">
        {entries.map((e) => (
          <li key={e.episodeId} className="flex items-center gap-3">
            {e.coverUrl ? (
              // arbitrary external art hosts; skip Vercel image optimization
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.coverUrl} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-tile object-cover" />
            ) : (
              <div className="h-9 w-9 shrink-0 rounded-tile bg-surface" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{e.title}</p>
              <p className="truncate text-xs text-zinc-500">
                {e.showTitle ? `${e.showTitle} · ` : ""}
                opened {formatWhen(e.openedAt)}
                {e.finishedAt
                  ? e.inferred
                    ? " · assumed finished"
                    : " · finished"
                  : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          clearHistory();
          refreshHistory();
        }}
        className="font-brand self-start rounded-[2px] border border-surface-border px-3 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
      >
        Clear history
      </button>
    </div>
  );
}
