"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getEpisodeCharts } from "@/src/data/catalog/client";
import type { ChartEpisodeItem } from "@/src/data/catalog/types";
import {
  isEpisodeSaved,
  removeEpisode,
  saveEpisode,
} from "@/src/data/repos/savedEpisodesRepo";
import { CoverPlay } from "@/src/features/player/CoverPlay";
import { previewEpisode } from "@/src/features/player/preview";
import { NothingToggle, SettleIn } from "@/src/ui";
import { ShowMoreButton } from "./Charts";
import { MachineLabel } from "./DiscoverPage";

/**
 * 热门单集 — the hot-EPISODES chart (小宇宙 play/comment data), shown beside
 * the show charts. Each row can be queued for Later with one tap, opened on
 * 小宇宙, or followed into the show via search. Hidden when the board is
 * unreachable — never an empty shell.
 */
const DEFAULT_VISIBLE = 10;

export function EpisodeCharts() {
  const [showAll, setShowAll] = useState(false);
  const q = useQuery({
    queryKey: ["catalog", "charts", "episodes"],
    queryFn: () => getEpisodeCharts(20),
    staleTime: 6 * 60 * 60 * 1000,
  });

  const eps = q.data?.episodes ?? [];
  if (q.isSuccess && eps.length === 0) return null;

  return (
    <section>
      <div className="mb-1 flex items-baseline gap-2">
        <h2 className="font-brand text-lg font-semibold">热门单集</h2>
        <MachineLabel>hot episodes</MachineLabel>
      </div>
      <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
        Single episodes people are discussing right now — each tagged with the
        forum or topic it&apos;s talked about in. Queue any for later.
      </p>

      {q.isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-card bg-surface" />
          ))}
        </div>
      ) : (
        <>
          <ol className="flex flex-col gap-2">
            {(showAll ? eps : eps.slice(0, DEFAULT_VISIBLE)).map((ep, i) => (
              <SettleIn key={ep.id} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
                <EpisodeRow ep={ep} />
              </SettleIn>
            ))}
          </ol>
          {eps.length > DEFAULT_VISIBLE && (
            <ShowMoreButton
              expanded={showAll}
              hiddenCount={eps.length - DEFAULT_VISIBLE}
              onClick={() => setShowAll((v) => !v)}
            />
          )}
        </>
      )}
    </section>
  );
}

function EpisodeRow({ ep }: { ep: ChartEpisodeItem }) {
  const queryClient = useQueryClient();
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void isEpisodeSaved(ep.id).then((v) => !cancelled && setQueued(v));
    return () => {
      cancelled = true;
    };
  }, [ep.id]);

  // ONE_CLICK: a single tap queues the hot episode into the Library
  function toggleLater() {
    const next = !queued;
    setQueued(next);
    void (next
      ? saveEpisode({
          id: ep.id,
          title: ep.title,
          showId: ep.showId,
          showTitle: ep.showTitle,
          coverUrl: ep.coverUrl,
          categories: [],
          appleUrl: ep.url,
          audioUrl: ep.audioUrl,
          durationSec: ep.durationSec,
        })
      : removeEpisode(ep.id)
    ).then(() => queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] }));
  }

  return (
    <li className="flex items-start gap-2.5 rounded-card border border-surface-border bg-background p-2.5 shadow-sm">
      {/* Matches the "More Ranks For You" episode row: cover + play triangle */}
      <CoverPlay
        src={ep.coverUrl}
        size={48}
        onPlay={() =>
          previewEpisode({
            id: ep.id,
            title: ep.title,
            showId: ep.showId,
            showTitle: ep.showTitle,
            coverUrl: ep.coverUrl,
            appleUrl: ep.url,
            audioUrl: ep.audioUrl,
            durationSec: ep.durationSec,
            categories: [],
          })
        }
        label={`Play a snippet of ${ep.title}`}
      />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-3 text-sm font-semibold leading-snug">{ep.title}</p>
        {ep.showTitle && (
          <Link
            href={`/search?q=${encodeURIComponent(ep.showTitle)}`}
            className="line-clamp-1 text-xs text-zinc-500 hover:text-accent dark:text-zinc-400"
          >
            {ep.showTitle} →
          </Link>
        )}
        {/* where it's being discussed — forum/topic, not a podcast-app link */}
        {ep.context && (
          <p className="line-clamp-1 text-[11px] font-medium text-accent">
            💬 {ep.context}
          </p>
        )}
        <p className="line-clamp-1 text-[11px] text-zinc-400">{ep.why}</p>
      </div>
      <NothingToggle
        active={queued}
        onClick={() => toggleLater()}
        ariaLabel={queued ? "Queued" : "Save for later"}
        className="shrink-0 !px-2"
      >
        {queued ? "✓" : "+"}
      </NothingToggle>
    </li>
  );
}
