"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getChineseCharts, getGlobalCharts } from "@/src/data/catalog/client";
import { SettleIn } from "@/src/ui";
import { MachineLabel } from "./DiscoverPage";
import { RankedRow } from "./RankedRecs";

type Tab = "chinese" | "global";

/**
 * Charts — the crowd's leaderboards, ranked by real signal rather than by
 * us: 中文播客榜 (小宇宙 subscribers/plays/comments, in the spirit of
 * xyzrank.com) and a Global board (Apple chart + Podcast Index trending +
 * Reddit discussion + Listen Score). Placed high so discovery-by-chart is
 * front and center. Each row is a real Wavr show — playable, saveable,
 * openable to its episodes. Hidden only when both boards are unreachable.
 */
export function Charts() {
  const [tab, setTab] = useState<Tab>("chinese");
  const zh = useQuery({
    queryKey: ["catalog", "charts", "chinese"],
    queryFn: () => getChineseCharts(24),
    staleTime: 24 * 60 * 60 * 1000,
  });
  const en = useQuery({
    queryKey: ["catalog", "charts", "global"],
    queryFn: () => getGlobalCharts(24),
    staleTime: 6 * 60 * 60 * 1000,
  });

  const active = tab === "chinese" ? zh : en;
  const shows = active.data?.shows ?? [];
  const bothSettledEmpty =
    zh.isSuccess &&
    en.isSuccess &&
    (zh.data?.shows.length ?? 0) === 0 &&
    (en.data?.shows.length ?? 0) === 0;
  if (bothSettledEmpty) return null;

  return (
    <section className="mb-12">
      <div className="mb-1 flex items-baseline gap-2">
        <h2 className="text-lg font-semibold">Charts</h2>
        <MachineLabel>ranked by the crowd, not us</MachineLabel>
      </div>
      <p className="mb-3 text-sm text-zinc-500">
        Real discussion, ratings and stream metrics — the shows people actually
        rally around, ordered.
      </p>

      <div className="mb-4 flex gap-2">
        <ChartTab label="中文播客榜" active={tab === "chinese"} onClick={() => setTab("chinese")} />
        <ChartTab label="Global" active={tab === "global"} onClick={() => setTab("global")} />
      </div>

      {active.isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-card bg-surface" />
          ))}
        </div>
      ) : shows.length === 0 ? (
        <p className="rounded-card border border-surface-border bg-surface px-4 py-6 text-center text-sm text-zinc-500">
          This board is quiet right now — check the other tab.
        </p>
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

function ChartTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-pill border px-4 py-1.5 text-sm font-semibold transition-colors ${
        active
          ? "border-accent bg-accent text-white"
          : "border-surface-border bg-surface text-zinc-500 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
