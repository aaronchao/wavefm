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
import { ShowRowCompact } from "./ShowRowCompact";

type Tab = "discussed" | "chinese" | "global";

/**
 * Charts — the crowd's leaderboards, community-first. 社区热议 is the Chinese
 * discussion board (豆瓣 + V2EX + Dcard/PTT/LIHKG + 小宇宙); 小宇宙 is the
 * 中文播客榜 leaderboard; Hot Buzz is what's talked about in English (Reddit +
 * Listen Score) — the Apple chart comes last because you've already scrolled
 * it. Each row is a real show: playable, saveable, openable, with tappable
 * evidence. Hidden only when every board is unreachable.
 */
const DEFAULT_VISIBLE = 10;

export function Charts() {
  const [picked, setPicked] = useState<Tab | null>(null);
  const [showAll, setShowAll] = useState(false);
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
        Community-first: 中文 discussion on 豆瓣 · V2EX · 小宇宙, and English Hot
        Buzz from Reddit — ranked by what people actually talk about.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <ChartTab label="社区热议" active={tab === "discussed"} onClick={() => setPicked("discussed")} />
        <ChartTab label="小宇宙" active={tab === "chinese"} onClick={() => setPicked("chinese")} />
        <ChartTab label="Hot Buzz" active={tab === "global"} onClick={() => setPicked("global")} />
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
        <>
          <ol className="flex flex-col gap-2.5">
            {(showAll ? shows : shows.slice(0, DEFAULT_VISIBLE)).map((show, i) => (
              <SettleIn key={show.id} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
                <ShowRowCompact show={show} />
              </SettleIn>
            ))}
          </ol>
          {shows.length > DEFAULT_VISIBLE && (
            <ShowMoreButton
              expanded={showAll}
              hiddenCount={shows.length - DEFAULT_VISIBLE}
              onClick={() => setShowAll((v) => !v)}
            />
          )}
        </>
      )}
    </section>
  );
}

/** Shared "Show N more / Show less" toggle for the capped chart lists. */
export function ShowMoreButton({
  expanded,
  hiddenCount,
  onClick,
}: {
  expanded: boolean;
  hiddenCount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-brand mt-3 w-full rounded-pill border border-surface-border bg-surface px-4 py-2 text-xs uppercase tracking-wider text-zinc-700 transition-colors hover:text-foreground dark:text-zinc-200"
    >
      {expanded ? "Show less ↑" : `Show ${hiddenCount} more ↓`}
    </button>
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
