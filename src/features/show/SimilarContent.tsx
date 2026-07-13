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
import { Card, Chip, CoverTile, SettleIn } from "@/src/ui";

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

function rowKeyDown(e: React.KeyboardEvent, action: () => void) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    action();
  }
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
      <SettleIn>
        {/* card click = 30-sec preview clip; Details -> show page */}
        <Card
          role="button"
          tabIndex={0}
          onClick={() => previewShow(show)}
          onKeyDown={(e) => rowKeyDown(e, () => previewShow(show))}
          className="flex cursor-pointer items-center gap-3"
        >
          <Rank n={rank} />
          <CoverTile src={show.coverUrl} size={56} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{show.title}</p>
            <p className="truncate text-sm text-zinc-500">{show.author}</p>
            <p className="truncate text-xs text-zinc-400">▶ {show.why}</p>
          </div>
          <Link
            href={`/show/${show.id}`}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Details →
          </Link>
          <Chip
            active={saved}
            onClick={(e) => {
              e.stopPropagation();
              toggleSave();
            }}
            className="shrink-0"
          >
            {saved ? "Saved ✓" : "Save"}
          </Chip>
        </Card>
      </SettleIn>
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
      <SettleIn>
        {/* card click = 30-sec preview clip of this episode */}
        <Card
          role="button"
          tabIndex={0}
          onClick={() => previewEpisode(episode)}
          onKeyDown={(e) => rowKeyDown(e, () => previewEpisode(episode))}
          className="flex cursor-pointer items-center gap-3"
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
                    onClick={(e) => e.stopPropagation()}
                    className="hover:underline"
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
            onClick={(e) => {
              e.stopPropagation();
              toggleLater();
            }}
            className="shrink-0"
          >
            {queued ? "Queued ✓" : "+ Later"}
          </Chip>
          {episode.appleUrl ? (
            <a
              href={episode.appleUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 rounded-pill bg-surface px-3 py-1.5 text-sm font-medium hover:opacity-80"
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
        </Card>
      </SettleIn>
    </li>
  );
}
