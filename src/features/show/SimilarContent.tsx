"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getSimilar } from "@/src/data/catalog/client";
import type { SimilarEpisode } from "@/src/data/catalog/types";
import {
  isEpisodeSaved,
  removeEpisode,
  saveEpisode,
} from "@/src/data/repos/savedEpisodesRepo";
import { previewEpisode } from "@/src/features/player/preview";
import { ShowRowCompact } from "@/src/features/discover/ShowRowCompact";
import { CoverTile } from "@/src/ui";

/**
 * "More like this" — similar Shows and Episodes side by side, matching the
 * Discovery and Search layouts. Language-matched upstream (a Chinese seed only
 * gets Chinese neighbours). Lazy, cached for hours, and silently absent when
 * providers are down. Shows reuse the discover ShowRowCompact (cover, reason,
 * one-tap play + save).
 */
export function SimilarContent({
  showId,
  seedTitle,
}: {
  showId: string;
  /** When set, the heading names the seed ("More like Dear Therapist"). */
  seedTitle?: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["catalog", "similar", showId],
    queryFn: () => getSimilar(showId),
    staleTime: 6 * 60 * 60 * 1000,
  });

  if (isLoading) {
    return <p className="text-sm text-zinc-500">Finding similar content…</p>;
  }
  // degraded or empty = quiet skip, never an error state
  if (!data || (data.shows.length === 0 && data.episodes.length === 0)) {
    return null;
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        {seedTitle ? `More like ${seedTitle}` : "More like this"}
      </h2>
      <div className="grid items-start gap-8 md:grid-cols-2">
        <section>
          <ColumnLabel>Shows</ColumnLabel>
          {data.shows.length === 0 ? (
            <p className="text-sm text-zinc-500">No similar shows surfaced.</p>
          ) : (
            <ol className="flex flex-col gap-2.5">
              {data.shows.map((s) => (
                <ShowRowCompact key={s.id} show={s} />
              ))}
            </ol>
          )}
        </section>
        <section>
          <ColumnLabel>Episodes</ColumnLabel>
          {data.episodes.length === 0 ? (
            <p className="text-sm text-zinc-500">No similar episodes surfaced.</p>
          ) : (
            <ol className="flex flex-col gap-2.5">
              {data.episodes.map((e) => (
                <SimilarEpisodeRow key={e.id} episode={e} />
              ))}
            </ol>
          )}
        </section>
      </div>
    </section>
  );
}

function ColumnLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-brand mb-3 text-xs font-bold uppercase tracking-[0.22em] text-zinc-800 dark:text-zinc-100">
      {children}
    </h3>
  );
}

function SimilarEpisodeRow({ episode }: { episode: SimilarEpisode }) {
  const queryClient = useQueryClient();
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void isEpisodeSaved(episode.id).then((v) => !cancelled && setQueued(v));
    return () => {
      cancelled = true;
    };
  }, [episode.id]);

  // ONE_CLICK: a single tap queues (or un-queues) the episode for later.
  function toggleLater() {
    const next = !queued;
    setQueued(next);
    void (next ? saveEpisode(episode) : removeEpisode(episode.id)).then(() =>
      queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] }),
    );
  }

  return (
    <li className="flex items-start gap-2.5 rounded-card border border-surface-border bg-background p-2.5 shadow-sm">
      <button
        type="button"
        onClick={() => previewEpisode(episode)}
        aria-label={`Preview ${episode.title}`}
        className="shrink-0"
      >
        <CoverTile src={episode.coverUrl} size={44} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">{episode.title}</p>
        {episode.showTitle &&
          (episode.showId ? (
            <Link
              href={`/show/${episode.showId}`}
              className="line-clamp-1 text-xs text-zinc-500 hover:text-accent dark:text-zinc-400"
            >
              {episode.showTitle} →
            </Link>
          ) : (
            <p className="line-clamp-1 text-xs text-zinc-500">{episode.showTitle}</p>
          ))}
        <p className="line-clamp-1 text-[11px] text-accent">◆ {episode.why}</p>
      </div>
      <button
        type="button"
        onClick={() => toggleLater()}
        aria-label={queued ? `Remove ${episode.title} from Later` : `Save ${episode.title} for later`}
        className={`shrink-0 rounded-full border px-2 py-1 text-xs font-medium transition-colors ${
          queued
            ? "border-accent bg-accent-soft text-accent"
            : "border-surface-border text-zinc-500 hover:border-accent hover:text-accent"
        }`}
      >
        {queued ? "✓" : "+ Later"}
      </button>
    </li>
  );
}
