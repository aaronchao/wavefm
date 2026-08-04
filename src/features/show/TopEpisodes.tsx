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
export function TopEpisodes({
  show,
  onEpisodeSelect,
}: {
  show: CatalogShow;
  /** Fired the moment any episode's Play is tapped — the Show page uses
   *  this to reveal its background globe's country fly-to only once
   *  there's been real engagement, not the instant the page loads. */
  onEpisodeSelect?: () => void;
}) {
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
        <h2 className="font-brand text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Top episodes
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {hasListens ? "most listened" : "where to start"}
        </span>
      </div>
      {q.isLoading && <p className="text-sm text-muted-foreground">Ranking episodes…</p>}
      <ol className="glass-panel flex flex-col gap-1.5 rounded-[1.75rem] p-3 shadow-lg">
        {episodes.map((ep, i) => (
          <TopEpisodeRow
            key={ep.id}
            ep={ep}
            show={show}
            rank={i + 1}
            showListens={hasListens}
            onSelect={onEpisodeSelect}
          />
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
  onSelect,
}: {
  ep: RankedEpisodeItem;
  show: CatalogShow;
  rank: number;
  showListens: boolean;
  onSelect?: () => void;
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
      <span className="w-6 shrink-0 text-center font-mono text-sm tabular-nums text-muted-foreground">
        {String(rank).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-3 text-sm font-medium">{ep.title}</p>
        <p className="truncate text-[11px] text-muted-foreground">
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
        onClick={() => {
          previewRankedEpisode(ep, show);
          onSelect?.();
        }}
        disabled={!ep.audioUrl}
        label={`Play the middle of ${ep.title}`}
      />
    </li>
  );
}
