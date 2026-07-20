"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getTopPicks } from "@/src/data/catalog/client";
import type { SimilarShow } from "@/src/data/catalog/types";
import {
  isSaved,
  listSaved,
  saveShow,
  unsaveShow,
} from "@/src/data/repos/savedShowsRepo";
import { previewShow } from "@/src/features/player/preview";
import { RatingBadges } from "@/src/features/show/RatingBadges";
import { useSession } from "@/src/state/useSession";
import { Chip, CoverTile, PlayableCard } from "@/src/ui";

/**
 * Top Picks: the "you can trust these" shelf at the bottom of Home —
 * highly rated / heavily discussed shows curated around what the user
 * saved. Quiet when providers are down or the pool is empty.
 */
export function TopPicks() {
  const { session } = useSession();
  const scope = session?.user.id ?? "local";
  const savedQ = useQuery({ queryKey: ["saved", scope], queryFn: listSaved });
  const seedIds = (savedQ.data ?? []).slice(0, 4).map((s) => s.show.id);

  const picksQ = useQuery({
    queryKey: ["catalog", "top-picks", seedIds.join(",")],
    queryFn: () => getTopPicks(seedIds),
    enabled: savedQ.isSuccess,
    staleTime: 6 * 60 * 60 * 1000,
  });

  if (!picksQ.data || picksQ.data.picks.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="mb-1 text-lg font-semibold">Top picks for you</h2>
      <p className="mb-3 text-sm text-zinc-500">
        Highly rated, talked about, and close to what you save.
      </p>
      <ol className="flex flex-col gap-3">
        {picksQ.data.picks.map((pick, i) => (
          <TopPickRow key={pick.id} pick={pick} rank={i + 1} />
        ))}
      </ol>
    </section>
  );
}

function TopPickRow({ pick, rank }: { pick: SimilarShow; rank: number }) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void isSaved(pick.id).then((v) => {
      if (!cancelled) setSaved(v);
    });
    return () => {
      cancelled = true;
    };
  }, [pick.id]);

  // ONE_CLICK invariant: a single click saves or unsaves (optimistic).
  function toggleSave() {
    const next = !saved;
    setSaved(next);
    void (next ? saveShow(pick) : unsaveShow(pick.id)).then(() =>
      queryClient.invalidateQueries({ queryKey: ["saved"] }),
    );
  }

  return (
    <li>
      <PlayableCard
        onPlay={() => previewShow(pick)}
        playLabel={`Preview ${pick.title}`}
        className="cursor-pointer"
      >
        <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-zinc-400">
          {rank}
        </span>
        <CoverTile src={pick.coverUrl} size={56} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{pick.title}</p>
          <p className="truncate text-sm text-zinc-500">{pick.author}</p>
          <p className="truncate text-xs text-zinc-400">▶ {pick.why}</p>
          <div className="mt-1">
            <RatingBadges showId={pick.id} title={pick.title} />
          </div>
        </div>
        <Link
          href={`/show/${pick.id}`}
          className="relative z-10 shrink-0 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Details →
        </Link>
        <Chip
          active={saved}
          onClick={() => toggleSave()}
          className="relative z-10 shrink-0"
        >
          {saved ? "Saved ✓" : "Save"}
        </Chip>
      </PlayableCard>
    </li>
  );
}
