"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getRankedEpisodes } from "@/src/data/catalog/client";
import type { CatalogShow, RankedEpisodeItem } from "@/src/data/catalog/types";
import {
  isEpisodeSaved,
  removeEpisode,
  saveEpisode,
} from "@/src/data/repos/savedEpisodesRepo";
import { previewRankedEpisode } from "@/src/features/player/preview";
import { NothingToggle, PlayButton } from "@/src/ui";

const BASIS_LABEL: Record<RankedEpisodeItem["basis"], string> = {
  listens: "Most listened",
  discussion: "Discussed",
  rating: "Rated",
  recent: "Recent",
};

/** Compact play-count formatting: 980, 12.4k, 1.2M. */
function formatListens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

/**
 * The show's own episodes, ranked "most listened" first when the backend
 * supplies play counts, otherwise by its signal ranking (discussion → rating
 * → recency). Each row plays a random middle section and can be queued to the
 * Library in one tap. Silent when the feed is unreachable.
 */
export function TopEpisodes({ show }: { show: CatalogShow }) {
  const q = useQuery({
    queryKey: ["catalog", "episodes-ranked", show.id],
    queryFn: () => getRankedEpisodes(show.id),
    staleTime: 6 * 60 * 60 * 1000,
  });

  if (q.isSuccess && q.data.length === 0) return null;

  // Rank by most-listened when play counts are present; the backend order is
  // the fallback so shows without listen data still rank sensibly.
  const episodes = [...(q.data ?? [])];
  const hasListens = episodes.some((e) => typeof e.listens === "number");
  if (hasListens) {
    episodes.sort((a, b) => (b.listens ?? -1) - (a.listens ?? -1));
  }

  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="font-brand text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Top episodes
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400">
          {hasListens ? "most listened" : "where to start"}
        </span>
      </div>
      {q.isLoading && <p className="text-sm text-zinc-400">Ranking episodes…</p>}
      <ol className="flex flex-col gap-1.5">
        {episodes.map((ep, i) => (
          <TopEpisodeRow key={ep.id} ep={ep} show={show} rank={i + 1} showListens={hasListens} />
        ))}
      </ol>
    </section>
  );
}

function TopEpisodeRow({
  ep,
  show,
  rank,
  showListens,
}: {
  ep: RankedEpisodeItem;
  show: CatalogShow;
  rank: number;
  showListens: boolean;
}) {
  const queryClient = useQueryClient();
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void isEpisodeSaved(ep.id).then((v) => !cancelled && setQueued(v));
    return () => {
      cancelled = true;
    };
  }, [ep.id]);

  // ONE_CLICK: queue this episode straight into the Library "Episodes" column
  function toggleLater() {
    const next = !queued;
    setQueued(next);
    void (next
      ? saveEpisode({
          id: ep.id,
          title: ep.title,
          showId: show.id,
          showTitle: show.title,
          coverUrl: show.coverUrl,
          appleUrl: show.appleUrl,
          audioUrl: ep.audioUrl,
          durationSec: ep.durationSec,
          publishedAt: ep.publishedAt,
          categories: [],
        })
      : removeEpisode(ep.id)
    ).then(() => queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] }));
  }

  const meta =
    showListens && typeof ep.listens === "number"
      ? `${formatListens(ep.listens)} listens`
      : ep.why;

  return (
    <li className="flex items-center gap-2.5 rounded-tile px-2 py-1.5 hover:bg-surface">
      <span className="w-6 shrink-0 text-center font-mono text-sm tabular-nums text-zinc-400">
        {String(rank).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-3 text-sm font-medium">{ep.title}</p>
        <p className="truncate text-[11px] text-zinc-400">
          <span
            className={`font-mono uppercase tracking-wider ${
              ep.basis === "discussion" || ep.basis === "listens" ? "text-accent" : ""
            }`}
          >
            {BASIS_LABEL[ep.basis]}
          </span>{" "}
          · {meta}
        </p>
      </div>
      <NothingToggle
        active={queued}
        onClick={() => toggleLater()}
        ariaLabel={queued ? `Remove ${ep.title} from Later` : `Save ${ep.title} for later`}
        className="shrink-0"
      >
        {queued ? "✓" : "+"}
      </NothingToggle>
      <PlayButton
        onClick={() => previewRankedEpisode(ep, show)}
        disabled={!ep.audioUrl}
        label={`Play the middle of ${ep.title}`}
      />
    </li>
  );
}
