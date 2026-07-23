"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { searchShows } from "@/src/data/catalog/client";
import type { CatalogShow } from "@/src/data/catalog/types";
import { previewShowTopEpisodeMiddle } from "@/src/features/player/preview";
import { CoverTile } from "@/src/ui";
import { MachineLabel } from "./DiscoverPage";

/** A default rotation so the shelf is never empty on "For you". */
const DEFAULT_TREND = "technology";

/**
 * Horizontal "trending" shelf, re-lensed by the active topic chip. Pure
 * browse — no personalization — so the discovery page always has fresh
 * territory to wander into. Tapping a tile plays its talked-about middle.
 */
export function TrendingShelf({
  topic,
  hideTitle = false,
}: {
  topic: string | null;
  /** Hide the "Trending" heading text — used when the shelf sits directly
   *  under another section (e.g. "For You") and a second title is noise. */
  hideTitle?: boolean;
}) {
  const query = topic ?? DEFAULT_TREND;
  const q = useQuery({
    queryKey: ["catalog", "search", query],
    queryFn: () => searchShows(query),
    staleTime: 6 * 60 * 60 * 1000,
  });

  const shows = (q.data?.shows ?? []).slice(0, 12);
  if (q.isSuccess && shows.length === 0) return null;

  return (
    <section className="mb-6">
      {!hideTitle && (
        <div className="mb-3 flex items-baseline gap-2">
          <h2 className="text-lg font-semibold">Trending</h2>
          <MachineLabel>in {query}</MachineLabel>
        </div>
      )}
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8">
        {q.isLoading
          ? [0, 1, 2, 3].map((i) => (
              <div key={i} className="h-40 w-32 shrink-0 animate-pulse rounded-card bg-surface" />
            ))
          : shows.map((show) => <TrendTile key={show.id} show={show} />)}
      </div>
    </section>
  );
}

function TrendTile({ show }: { show: CatalogShow }) {
  return (
    <div className="w-32 shrink-0 snap-start">
      <button
        type="button"
        onClick={() => previewShowTopEpisodeMiddle(show)}
        aria-label={`Play the talked-about bit of ${show.title}`}
        className="group relative block w-full overflow-hidden rounded-card"
      >
        <CoverTile src={show.coverUrl} size={128} className="!h-32 !w-32" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-2xl text-white opacity-0 transition-opacity group-hover:bg-black/30 group-hover:opacity-100">
          ▶
        </span>
      </button>
      <Link href={`/show/${show.id}`} className="mt-1.5 block">
        <p className="truncate text-xs font-semibold">{show.title}</p>
        <p className="truncate text-[11px] text-zinc-500">{show.author}</p>
      </Link>
    </div>
  );
}
