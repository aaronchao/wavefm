"use client";

import { useQuery } from "@tanstack/react-query";
import { getChineseCharts } from "@/src/data/catalog/client";
import { SettleIn } from "@/src/ui";
import { MachineLabel } from "./DiscoverPage";
import { RankedRow } from "./RankedRecs";

/**
 * 中文播客榜 — a Chinese-podcast leaderboard in the spirit of xyzrank.com,
 * ranked by 小宇宙 subscribers/plays and resolved into Wavr shows so each
 * is playable, saveable, and openable to its episodes. Silent when the
 * board or the CN storefront is unreachable, so it never leaves an empty
 * heading behind.
 */
export function ChineseCharts() {
  const q = useQuery({
    queryKey: ["catalog", "charts", "chinese"],
    queryFn: () => getChineseCharts(24),
    staleTime: 24 * 60 * 60 * 1000,
  });

  const shows = q.data?.shows ?? [];
  if (q.isSuccess && shows.length === 0) return null;

  return (
    <section className="mb-12">
      <div className="mb-1 flex items-baseline gap-2">
        <h2 className="text-lg font-semibold">中文播客榜</h2>
        <MachineLabel>Chinese charts</MachineLabel>
      </div>
      <p className="mb-4 text-sm text-zinc-500">
        The most-subscribed Chinese podcasts on 小宇宙, ranked — tap to hear the
        middle of the episode people talk about.
      </p>

      {q.isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-card bg-surface" />
          ))}
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {shows.map((show, i) => (
            <SettleIn key={show.id} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
              <RankedRow pick={show} rank={i + 1} />
            </SettleIn>
          ))}
        </ol>
      )}
    </section>
  );
}
