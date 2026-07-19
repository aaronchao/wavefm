"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { defaultTopics } from "@/src/core/recommend";
import { listSaved } from "@/src/data/repos/savedShowsRepo";
import { useSession } from "@/src/state/useSession";
import { Charts } from "./Charts";
import { ForYouHero } from "./ForYouHero";
import { RankedRecs } from "./RankedRecs";
import { SavedRails } from "./SavedRails";
import { TrendingShelf } from "./TrendingShelf";
import { useDiscoverPicks } from "./useDiscoverPicks";

/** Monospace "machine" micro-label — the Nothing-brand technical voice. */
export function MachineLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 ${className}`}
    >
      {children}
    </span>
  );
}

const TOPICS = defaultTopics();

/**
 * Discover: the ranked, discussion-first exploration surface. Recommended
 * shows are ordered top to bottom; one click plays a random middle section
 * of the show's most-talked-about episode. Open a show to see its episodes
 * ranked by real signal (discussion → rating → recency), each labelled
 * honestly. Topic chips re-lens the Trending shelf. Nothing-brand identity:
 * monochrome machine type, a single Signal-Red accent, dot-matrix marks.
 */
export function DiscoverPage() {
  const { session } = useSession();
  const scope = session?.user.id ?? "local";
  const savedQ = useQuery({ queryKey: ["saved", scope], queryFn: listSaved });
  const saved = savedQ.data ?? [];
  const seedIds = saved.slice(0, 4).map((s) => s.show.id);

  const [topic, setTopic] = useState<string | null>(null);
  const picks = useDiscoverPicks({ seedIds, topic, savedReady: savedQ.isSuccess });
  const heroPicks = picks.hero ? [picks.hero, ...picks.rest] : [];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-44 pt-6 sm:px-8">
      {/* Masthead */}
      <div className="mb-8 border-b border-surface-border pb-6">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
          <MachineLabel>Wavr · Discovery Engine</MachineLabel>
        </div>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Discover</h1>
        <p className="mt-2 max-w-lg text-zinc-500">
          Ranked by the discussion behind them. One tap plays the middle of the
          episode people actually talk about — no intros, no ads.
        </p>
      </div>

      {/* Topic lens */}
      <div className="mb-8 flex flex-wrap gap-2">
        <TopicChip label="For you" active={topic === null} onClick={() => setTopic(null)} />
        {TOPICS.map((t) => (
          <TopicChip
            key={t}
            label={t}
            active={topic === t}
            onClick={() => setTopic((cur) => (cur === t ? null : t))}
          />
        ))}
      </div>

      {/* The payoff: one great pick, researched for you */}
      <ForYouHero key={topic ?? "all"} picks={heroPicks} />

      {/* Charts up top for visibility — the crowd's leaderboards */}
      <Charts />

      {/* The rest of the personalized ranking */}
      <RankedRecs
        rest={picks.rest}
        count={picks.count}
        topic={topic}
        topicApplied={picks.topicApplied}
        isLoading={picks.isLoading}
      />

      <SavedRails saved={saved} />

      <TrendingShelf topic={topic} />
    </main>
  );
}

function TopicChip({
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
      className={`rounded-pill border px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors ${
        active
          ? "border-accent bg-accent text-white"
          : "border-surface-border bg-surface text-zinc-500 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
