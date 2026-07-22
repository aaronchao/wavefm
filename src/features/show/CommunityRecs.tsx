"use client";

import { useQuery } from "@tanstack/react-query";
import { getCommunityRecs } from "@/src/data/catalog/client";
import { MachineLabel } from "@/src/features/discover/DiscoverPage";
import { ShowRowCompact } from "@/src/features/discover/ShowRowCompact";
import { SettleIn } from "@/src/ui";

/**
 * "Listeners also recommend" — recommendations mined from real community
 * discussion (rec_edges), shown above the algorithmic Similar list on a show
 * page. Each row carries its human reason and tappable thread evidence (reusing
 * the discover ShowRowCompact + Evidence). Renders nothing until the pipeline
 * has edges for this seed, so SimilarContent seamlessly covers the cold state.
 */
export function CommunityRecs({ seedId }: { seedId: string }) {
  const q = useQuery({
    queryKey: ["recs", "community", seedId],
    queryFn: () => getCommunityRecs(seedId),
    staleTime: 60 * 60 * 1000,
  });
  const shows = q.data?.shows ?? [];
  if (shows.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="mb-1 flex items-baseline gap-2">
        <h2 className="font-brand text-lg font-semibold">Listeners also recommend</h2>
        <MachineLabel>from community discussion</MachineLabel>
      </div>
      <p className="mb-3 text-sm text-zinc-500">
        People who talk about this show pair it with these — tap a reason to read
        the actual thread.
      </p>
      <ol className="flex flex-col gap-2.5">
        {shows.map((s, i) => (
          <SettleIn key={s.id} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
            <ShowRowCompact show={s} />
          </SettleIn>
        ))}
      </ol>
    </section>
  );
}
