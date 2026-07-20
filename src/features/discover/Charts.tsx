"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  getChineseCharts,
  getDiscussedCharts,
  getGlobalCharts,
} from "@/src/data/catalog/client";
import { SettleIn } from "@/src/ui";
import { MachineLabel } from "./DiscoverPage";
import { RankedRow } from "./RankedRecs";

type Tab = "discussed" | "chinese" | "global";

/**
 * Charts — the crowd's leaderboards, community-first. We lead with the
 * boards ranked by real discussion (社区热议: Reddit + V2EX + 小宇宙; and
 * 中文播客榜, the 小宇宙 leaderboard) and keep the Apple-based board last —
 * you've already scrolled Apple, that's why you're here. Each row is a real
 * show: playable, saveable, openable to episodes, with tappable evidence.
 * Hidden only when every board is unreachable.
 */
export function Charts() {
  const [picked, setPicked] = useState<Tab | null>(null);
  const discussed = useQuery({
    queryKey: ["catalog", "charts", "discussed"],
    queryFn: () => getDiscussedCharts(24),
    staleTime: 6 * 60 * 60 * 1000,
  });
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

  const counts: Record<Tab, number> = {
    discussed: discussed.data?.shows.length ?? 0,
    chinese: zh.data?.shows.length ?? 0,
    global: en.data?.shows.length ?? 0,
  };
  const queries: Record<Tab, typeof discussed> = { discussed, chinese: zh, global: en };

  // auto-focus the first community board that has data (never open empty)
  const autoTab: Tab =
    counts.discussed > 0 ? "discussed" : counts.chinese > 0 ? "chinese" : "global";
  const tab: Tab = picked ?? autoTab;
  const active = queries[tab];
  const shows = active.data?.shows ?? [];

  const allSettledEmpty =
    discussed.isSuccess && zh.isSuccess && en.isSuccess &&
    counts.discussed === 0 && counts.chinese === 0 && counts.global === 0;
  if (allSettledEmpty) return null;

  return (
    <section>
      <div className="mb-1 flex items-baseline gap-2">
        <h2 className="font-brand text-lg font-semibold">Charts</h2>
        <MachineLabel>ranked by the crowd, not the charts</MachineLabel>
      </div>
      <p className="mb-3 text-sm text-zinc-500">
        Community-first: what people actually discuss on Reddit, V2EX & 小宇宙 —
        Apple comes last.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <ChartTab label="社区热议" active={tab === "discussed"} onClick={() => setPicked("discussed")} />
        <ChartTab label="小宇宙" active={tab === "chinese"} onClick={() => setPicked("chinese")} />
        <ChartTab label="Apple" active={tab === "global"} onClick={() => setPicked("global")} />
      </div>

      {active.isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-card bg-surface" />
          ))}
        </div>
      ) : shows.length === 0 ? (
        <p className="rounded-card border border-surface-border bg-surface px-4 py-6 text-center text-sm text-zinc-500">
          This board is quiet right now — try another tab.
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
      className={`font-brand rounded-pill border px-4 py-1.5 text-sm font-semibold transition-colors ${
        active
          ? "border-accent bg-accent text-white"
          : "border-surface-border bg-surface text-zinc-500 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
