"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { CatalogEpisode, CatalogShow } from "@/src/data/catalog/types";
import {
  isEpisodeSaved,
  removeEpisode,
  saveEpisode,
} from "@/src/data/repos/savedEpisodesRepo";
import { isSaved, saveShow, unsaveShow } from "@/src/data/repos/savedShowsRepo";
import { previewEpisode, previewShow } from "@/src/features/player/preview";
import { CoverTile, NothingToggle, PlayableCard } from "@/src/ui";

/** A matching episode with one-click "Later" to queue it into the Library. */
export function SearchEpisodeRow({ episode }: { episode: CatalogEpisode }) {
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

  // ONE_CLICK: a single tap queues (or un-queues) the episode for later.
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
        className="cursor-pointer gap-4"
      >
        <CoverTile src={episode.coverUrl} size={56} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-3 font-semibold leading-snug">{episode.title}</p>
          {episode.showTitle &&
            (episode.showId ? (
              <Link
                href={`/show/${episode.showId}`}
                className="relative z-10 line-clamp-1 text-sm text-zinc-500 hover:text-accent hover:underline underline-offset-2 dark:text-zinc-400"
              >
                {episode.showTitle} →
              </Link>
            ) : (
              <p className="line-clamp-1 text-sm text-zinc-500">{episode.showTitle}</p>
            ))}
          <p className="truncate text-xs text-zinc-400">▶ Click for a 30s clip</p>
        </div>
        <NothingToggle
          active={queued}
          onClick={(e) => {
            e.stopPropagation();
            toggleLater();
          }}
          // aria-label keeps the accessible name stable for tests/screen
          // readers even though the visible label is now icon-only.
          ariaLabel={queued ? "Queued ✓" : "+ Later"}
          className="relative z-10 shrink-0"
        >
          {queued ? "✓" : "+"}
        </NothingToggle>
      </PlayableCard>
    </li>
  );
}

export function SearchShowRow({ show }: { show: CatalogShow }) {
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
        className="cursor-pointer gap-4"
      >
        <CoverTile src={show.coverUrl} size={64} />
        <div className="min-w-0 flex-1">
          <Link
            href={`/show/${show.id}`}
            className="relative z-10 line-clamp-2 font-semibold leading-snug hover:text-accent hover:underline underline-offset-2"
          >
            {show.title}
          </Link>
          <p className="line-clamp-1 text-sm text-zinc-500">{show.author}</p>
          <p className="truncate text-xs text-zinc-400">▶ Click for a 30s clip</p>
        </div>
        <NothingToggle
          active={saved}
          onClick={(e) => {
            e.stopPropagation();
            toggleSave();
          }}
          ariaLabel={saved ? "Saved ✓" : "Save"}
          className="relative z-10 shrink-0"
        >
          {saved ? "✓" : "+"}
        </NothingToggle>
      </PlayableCard>
    </li>
  );
}
