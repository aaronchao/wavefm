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
import { Chip, SettleIn } from "@/src/ui";
import { MachineLabel } from "./DiscoverPage";

/**
 * 热门单集 — the hot-EPISODES chart (小宇宙 play/comment data), shown beside
 * the show charts. Each row can be queued for Later with one tap, opened on
 * 小宇宙, or followed into the show via search. Hidden when the board is
 * unreachable — never an empty shell.
 */
export function EpisodeCharts() {
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
        The single episodes people play and argue about on 小宇宙 — queue any
        for later.
      </p>

      {q.isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-card bg-surface" />
          ))}
        </div>
      ) : (
        <ol className="flex flex-col gap-2">
          {eps.map((ep, i) => (
            <SettleIn key={ep.id} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
              <EpisodeRow ep={ep} rank={i + 1} />
            </SettleIn>
          ))}
        </ol>
      )}
    </section>
  );
}

function EpisodeRow({ ep, rank }: { ep: ChartEpisodeItem; rank: number }) {
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
          showTitle: ep.showTitle,
          categories: [],
          appleUrl: ep.url,
        })
      : removeEpisode(ep.id)
    ).then(() => queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] }));
  }

  return (
    <li className="flex items-center gap-2.5 rounded-card border border-surface-border bg-background p-2.5 shadow-sm">
      <span className="font-brand w-7 shrink-0 text-center text-sm font-bold tabular-nums text-zinc-400 dark:text-zinc-500">
        {String(rank).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{ep.title}</p>
        {ep.showTitle && (
          <Link
            href={`/search?q=${encodeURIComponent(ep.showTitle)}`}
            className="truncate text-xs text-zinc-500 hover:text-accent dark:text-zinc-400"
          >
            {ep.showTitle} →
          </Link>
        )}
        <p className="truncate text-[11px] text-accent">◆ {ep.why}</p>
      </div>
      {ep.url && (
        <a
          href={ep.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-pill bg-surface px-2.5 py-1 text-xs font-medium hover:opacity-80"
        >
          小宇宙 ↗
        </a>
      )}
      <Chip active={queued} onClick={() => toggleLater()} className="shrink-0 !py-1 !text-xs">
        {queued ? "✓" : "+ Later"}
      </Chip>
    </li>
  );
}
