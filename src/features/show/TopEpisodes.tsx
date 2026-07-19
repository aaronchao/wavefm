"use client";

import { useQuery } from "@tanstack/react-query";
import { getRankedEpisodes } from "@/src/data/catalog/client";
import type { CatalogShow, RankedEpisodeItem } from "@/src/data/catalog/types";
import { previewRankedEpisode } from "@/src/features/player/preview";

const BASIS_LABEL: Record<RankedEpisodeItem["basis"], string> = {
  discussion: "Discussed",
  rating: "Rated",
  recent: "Recent",
};

/**
 * The show's own episodes, ranked top to bottom by real signal
 * (discussion → rating → recency) — the "what to start with" list on a
 * show page. Each row plays a random middle section. Silent when the feed
 * is unreachable, so it never leaves a dead heading behind.
 */
export function TopEpisodes({ show }: { show: CatalogShow }) {
  const q = useQuery({
    queryKey: ["catalog", "episodes-ranked", show.id],
    queryFn: () => getRankedEpisodes(show.id),
    staleTime: 6 * 60 * 60 * 1000,
  });

  if (q.isSuccess && q.data.length === 0) return null;

  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Top episodes
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400">
          where to start
        </span>
      </div>
      {q.isLoading && <p className="text-sm text-zinc-400">Ranking episodes…</p>}
      <ol className="flex flex-col gap-1.5">
        {(q.data ?? []).map((ep, i) => (
          <li
            key={ep.id}
            className="flex items-center gap-2.5 rounded-tile px-2 py-1.5 hover:bg-surface"
          >
            <span className="w-6 shrink-0 text-center font-mono text-sm tabular-nums text-zinc-400">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{ep.title}</p>
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
              className="shrink-0 rounded-full border border-surface-border px-3 py-1 text-xs font-medium text-zinc-500 transition-colors hover:border-accent hover:text-accent disabled:opacity-30"
            >
              ▶ Play
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
