"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { searchShows } from "@/src/data/catalog/client";
import { searchShowsByTerms } from "@/src/data/catalog/interestSearch";
import type { CatalogShow } from "@/src/data/catalog/types";
import { previewShowTopEpisodeMiddle } from "@/src/features/player/preview";
import { CoverTile, MachineLabel } from "@/src/ui";

/** A default rotation so the shelf is never empty with no interests at all. */
const DEFAULT_TREND = "technology";

/**
 * Horizontal "today's picks" shelf, re-lensed by the active topic chip and,
 * by default, by the user's own "For You" interests — real catalog search
 * results per interest, merged round-robin, never a fixed generic query.
 * Tapping a tile plays its talked-about middle.
 */
export function TrendingShelf({
  topic,
  lenses = [],
  hideTitle = false,
}: {
  topic: string | null;
  /** The active "For You" interests — drives the shelf when no topic is tapped. */
  lenses?: string[];
  /** Hide the heading text — used when the shelf sits directly under
   *  another section (e.g. "For You") and a second title is noise. */
  hideTitle?: boolean;
}) {
  const query = topic ?? null;
  const singleQ = useQuery({
    queryKey: ["catalog", "search", query ?? DEFAULT_TREND],
    queryFn: () => searchShows(query ?? DEFAULT_TREND),
    staleTime: 6 * 60 * 60 * 1000,
    enabled: Boolean(query) || lenses.length === 0,
  });
  const lensQ = useQuery({
    queryKey: ["catalog", "interest-search", lenses.join(",")],
    queryFn: () => searchShowsByTerms(lenses),
    staleTime: 6 * 60 * 60 * 1000,
    enabled: !query && lenses.length > 0,
  });

  const usingLenses = !query && lenses.length > 0;
  const isLoading = usingLenses ? lensQ.isLoading : singleQ.isLoading;
  const isSuccess = usingLenses ? lensQ.isSuccess : singleQ.isSuccess;
  const shows = usingLenses
    ? lensQ.data?.map((m) => m.show).slice(0, 20) ?? []
    : (singleQ.data?.shows ?? []).slice(0, 20);
  if (isSuccess && shows.length === 0) return null;

  return (
    <section className="mb-6">
      {!hideTitle && (
        <div className="mb-3 flex items-baseline gap-2">
          <h2 className="text-lg font-semibold">Today&rsquo;s Picks</h2>
          {!usingLenses && <MachineLabel>in {query ?? DEFAULT_TREND}</MachineLabel>}
        </div>
      )}
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8">
        {isLoading
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
