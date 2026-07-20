"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getSimilar } from "@/src/data/catalog/client";
import type { SimilarEpisode, SimilarShow } from "@/src/data/catalog/types";
import {
  isEpisodeSaved,
  removeEpisode,
  saveEpisode,
} from "@/src/data/repos/savedEpisodesRepo";
import { isSaved, saveShow, unsaveShow } from "@/src/data/repos/savedShowsRepo";
import { previewEpisode, previewShow } from "@/src/features/player/preview";
import { RatingBadges } from "@/src/features/show/RatingBadges";
import { Chip, CoverTile, PlayableCard } from "@/src/ui";

/**
 * "More like this": similar shows AND similar episodes, ranked top to
 * bottom by similarity + popularity metrics. Clicking a row plays a
 * 30-second clip; Details/show links navigate. Lazy, cached for hours,
 * and silently absent when providers are down.
 */
export function SimilarContent({
  showId,
  seedTitle,
}: {
  showId: string;
  /** When set, the heading names the seed ("More like Dear Therapist"). */
  seedTitle?: string;
}) {
  const [tab, setTab] = useState<"shows" | "episodes">("shows");
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

  const items = tab === "shows" ? data.shows : data.episodes;

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        {seedTitle ? `More like ${seedTitle}` : "More like this"}
      </h2>
      <div className="mb-3 flex gap-2">
        <Chip active={tab === "shows"} onClick={() => setTab("shows")}>
          Shows ({data.shows.length})
        </Chip>
        <Chip active={tab === "episodes"} onClick={() => setTab("episodes")}>
          Episodes ({data.episodes.length})
        </Chip>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Nothing similar surfaced here — try the other tab.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {tab === "shows"
            ? data.shows.map((s, i) => (
                <SimilarShowRow key={s.id} show={s} rank={i + 1} />
              ))
            : data.episodes.map((e, i) => (
                <SimilarEpisodeRow key={e.id} episode={e} rank={i + 1} />
              ))}
        </ol>
      )}
    </section>
  );
}

function Rank({ n }: { n: number }) {
  return (
    <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-zinc-400">
      {n}
    </span>
  );
}


function SimilarShowRow({ show, rank }: { show: SimilarShow; rank: number }) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void isSaved(show.id).then((v) => {
      if (!cancelled) setSaved(v);
    });
    return () => {
      cancelled = true;
    };
  }, [show.id]);

  // ONE_CLICK invariant: a single click saves or unsaves (optimistic).
  function toggleSave() {
    const next = !saved;
    setSaved(next);
    void (next ? saveShow(show) : unsaveShow(show.id)).then(() =>
      queryClient.invalidateQueries({ queryKey: ["saved"] }),
    );
  }

  return (
    <li>
      <PlayableCard
        onPlay={() => previewShow(show)}
        playLabel={`Preview ${show.title}`}
        className="cursor-pointer"
      >
        <Rank n={rank} />
        <CoverTile src={show.coverUrl} size={56} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{show.title}</p>
          <p className="truncate text-sm text-zinc-500">{show.author}</p>
          <p className="truncate text-xs text-zinc-400">▶ {show.why}</p>
          <div className="mt-1">
            <RatingBadges showId={show.id} title={show.title} />
          </div>
        </div>
        <Link
          href={`/show/${show.id}`}
          className="relative z-10 shrink-0 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Details →
        </Link>
        <Chip
          active={saved}
          onClick={() => toggleSave()}
          className="relative z-10 shrink-0"
        >
          {saved ? "Saved ✓" : "Save"}
        </Chip>
      </PlayableCard>
    </li>
  );
}

function SimilarEpisodeRow({
  episode,
  rank,
}: {
  episode: SimilarEpisode;
  rank: number;
}) {
  const queryClient = useQueryClient();
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void isEpisodeSaved(episode.id).then((v) => {
      if (!cancelled) setQueued(v);
    });
    return () => {
      cancelled = true;
    };
  }, [episode.id]);

  // ONE_CLICK invariant: a single click queues for listen-later.
  function toggleLater() {
    const next = !queued;
    setQueued(next);
    void (next ? saveEpisode(episode) : removeEpisode(episode.id)).then(() =>
      queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] }),
    );
  }

  return (
    <li>
      <PlayableCard
        onPlay={() => previewEpisode(episode)}
        playLabel={`Preview ${episode.title}`}
        className="cursor-pointer"
      >
        <Rank n={rank} />
        <CoverTile src={episode.coverUrl} size={56} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{episode.title}</p>
          {episode.showTitle && (
            <p className="truncate text-sm text-zinc-500">
              {episode.showId ? (
                <Link
                  href={`/show/${episode.showId}`}
                  className="relative z-10 hover:underline"
                >
                  {episode.showTitle}
                </Link>
              ) : (
                episode.showTitle
              )}
            </p>
          )}
          <p className="truncate text-xs text-zinc-400">▶ {episode.why}</p>
        </div>
        <Chip
          active={queued}
          onClick={() => toggleLater()}
          className="relative z-10 shrink-0"
        >
          {queued ? "Queued ✓" : "+ Later"}
        </Chip>
        {episode.appleUrl ? (
          <a
            href={episode.appleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-10 shrink-0 rounded-pill bg-surface px-3 py-1.5 text-sm font-medium hover:opacity-80"
          >
            Full ↗
          </a>
        ) : (
          // missing platform = dimmed chip, never an error (Section 6)
          <span
            aria-disabled
            className="shrink-0 cursor-not-allowed rounded-pill bg-surface px-3 py-1.5 text-sm font-medium opacity-40"
          >
            Full
          </span>
        )}
      </PlayableCard>
    </li>
  );
}
