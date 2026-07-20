"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getSimilar } from "@/src/data/catalog/client";
import type { SavedShow } from "@/src/data/repos/savedShowsRepo";
import type { SimilarShow } from "@/src/data/catalog/types";
import { previewShowTopEpisodeMiddle } from "@/src/features/player/preview";
import { CoverTile } from "@/src/ui";
import { MachineLabel } from "./DiscoverPage";

/**
 * "Because you saved …" rails — one horizontal shelf of near neighbours for
 * each of the user's most recent saves. Quiet when nothing is saved or the
 * catalog is unreachable, so it never leaves an empty heading behind.
 */
export function SavedRails({ saved }: { saved: SavedShow[] }) {
  const seeds = saved.slice(0, 2);
  if (seeds.length === 0) return null;
  return (
    <div className="mb-12">
      {seeds.map((s) => (
        <SavedRail key={s.show.id} seed={s} />
      ))}
    </div>
  );
}

function SavedRail({ seed }: { seed: SavedShow }) {
  const q = useQuery({
    queryKey: ["catalog", "similar", seed.show.id],
    queryFn: () => getSimilar(seed.show.id),
    staleTime: 6 * 60 * 60 * 1000,
  });

  const shows = (q.data?.shows ?? []).slice(0, 10);
  if (!q.isSuccess || shows.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-lg font-semibold">Because you saved</h2>
        <MachineLabel className="truncate">{seed.show.title}</MachineLabel>
      </div>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8">
        {shows.map((show) => (
          <RailTile key={show.id} show={show} />
        ))}
      </div>
    </section>
  );
}

function RailTile({ show }: { show: SimilarShow }) {
  return (
    <div className="w-36 shrink-0 snap-start">
      <button
        type="button"
        onClick={() => previewShowTopEpisodeMiddle(show)}
        aria-label={`Play the talked-about bit of ${show.title}`}
        className="group relative block w-full overflow-hidden rounded-card"
      >
        <CoverTile src={show.coverUrl} size={144} className="!h-36 !w-36" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-2xl text-white opacity-0 transition-opacity group-hover:bg-black/30 group-hover:opacity-100">
          ▶
        </span>
      </button>
      <Link href={`/show/${show.id}`} className="mt-1.5 block">
        <p className="truncate text-xs font-semibold">{show.title}</p>
        <p className="truncate text-[11px] text-accent">{show.why}</p>
      </Link>
    </div>
  );
}
