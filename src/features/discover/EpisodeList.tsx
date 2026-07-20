"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getRankedEpisodes } from "@/src/data/catalog/client";
import type { RankedEpisodeItem, SimilarShow } from "@/src/data/catalog/types";
import {
  isEpisodeSaved,
  removeEpisode,
  saveEpisode,
} from "@/src/data/repos/savedEpisodesRepo";
import { previewRankedEpisode } from "@/src/features/player/preview";

const BASIS_LABEL: Record<RankedEpisodeItem["basis"], string> = {
  discussion: "Discussed",
  rating: "Rated",
  recent: "Recent",
};

/** Lazy, collapsible list of a show's episodes ranked by real signal. */
export function EpisodeList({ show }: { show: SimilarShow }) {
  const [open, setOpen] = useState(false);
  const epsQ = useQuery({
    queryKey: ["catalog", "episodes-ranked", show.id],
    queryFn: () => getRankedEpisodes(show.id),
    enabled: open,
    staleTime: 6 * 60 * 60 * 1000,
  });

  return (
    <div className="mt-2 border-t border-surface-border pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 hover:text-foreground"
      >
        <span className={`transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
        Top episodes
      </button>
      {open && (
        <div className="mt-2">
          {epsQ.isLoading && (
            <p className="py-2 text-xs text-zinc-400">Ranking episodes…</p>
          )}
          {epsQ.isSuccess && epsQ.data.length === 0 && (
            <p className="py-2 text-xs text-zinc-400">
              No episode feed reachable — try the show page.
            </p>
          )}
          <ol className="flex flex-col gap-1.5">
            {(epsQ.data ?? []).map((ep, i) => (
              <EpisodeRow key={ep.id} ep={ep} rank={i + 1} show={show} />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function EpisodeRow({
  ep,
  rank,
  show,
}: {
  ep: RankedEpisodeItem;
  rank: number;
  show: SimilarShow;
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

  // ONE_CLICK: queue this top episode straight into the Library
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

  return (
    <li className="flex items-center gap-2.5 rounded-tile px-2 py-1.5 hover:bg-surface">
      <span className="w-5 shrink-0 text-center font-mono text-xs tabular-nums text-zinc-400">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{ep.title}</p>
        <p className="truncate text-[11px] text-zinc-400">
          <span
            className={`font-mono uppercase tracking-wider ${
              ep.basis === "discussion" ? "text-accent" : ""
            }`}
          >
            {BASIS_LABEL[ep.basis]}
          </span>{" "}
          · {ep.why}
        </p>
      </div>
      <button
        type="button"
        onClick={() => previewRankedEpisode(ep, show)}
        disabled={!ep.audioUrl}
        aria-label={`Play the middle of ${ep.title}`}
        className="shrink-0 rounded-full border border-surface-border px-2.5 py-1 text-xs font-medium text-zinc-500 transition-colors hover:border-accent hover:text-accent disabled:opacity-30"
      >
        ▶
      </button>
      <button
        type="button"
        onClick={() => toggleLater()}
        aria-label={queued ? `Remove ${ep.title} from Later` : `Save ${ep.title} for later`}
        className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
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
