"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getPrefs } from "@/src/data/repos/prefsRepo";
import { listSaved } from "@/src/data/repos/savedShowsRepo";
import { FloatingSearch } from "@/src/features/search/FloatingSearch";
import { useSession } from "@/src/state/useSession";
import { Charts } from "./Charts";
import { EpisodeCharts } from "./EpisodeCharts";
import { RankedRecs } from "./RankedRecs";
import { SavedRails } from "./SavedRails";
import { SurpriseDeck } from "./SurpriseDeck";
import { TodaysPicks } from "./TodaysPicks";
import { TrendingShelf } from "./TrendingShelf";
import { useDiscoverPicks } from "./useDiscoverPicks";

/** Dot-matrix "machine" micro-label — the Nothing-brand technical voice. */
export function MachineLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`font-brand text-[11px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-300 ${className}`}
    >
      {children}
    </span>
  );
}

/** High-contrast section heading (dot-matrix) — readable, not whispery. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-brand text-xs font-bold uppercase tracking-[0.22em] text-zinc-800 dark:text-zinc-100">
      {children}
    </span>
  );
}

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
  const [deckOpen, setDeckOpen] = useState(false);

  // "For You" — the user's own custom interests from Settings (no presets,
  // no live trending fetch). These drive Today's Picks by default; tapping
  // one narrows to just that interest, same mechanism as before.
  const prefsQ = useQuery({ queryKey: ["prefs", scope], queryFn: getPrefs });
  const interests = prefsQ.data?.interests ?? [];
  const picks = useDiscoverPicks({ seedIds, topic, interests, savedReady: savedQ.isSuccess });
  const heroPicks = picks.hero ? [picks.hero, ...picks.rest] : [];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-44 pt-6 sm:px-8">
      {deckOpen && <SurpriseDeck picks={heroPicks} onClose={() => setDeckOpen(false)} />}
      {/* Masthead */}
      <div className="mb-8 border-b border-surface-border pb-6">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
          <MachineLabel>wavefm · Discovery Engine</MachineLabel>
        </div>
        <h1 className="font-brand mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Discover</h1>
        <p className="mt-2 max-w-lg text-zinc-500">
          Rankings & recommendations are sourced from community &amp; forum
          discussions —{" "}
          <span className="text-foreground">Reddit · 豆瓣 · V2EX · PTT · Dcard · LIHKG · 小宇宙</span>,
          not the charts. One tap plays the bit they actually argue about.
        </p>
        <button
          type="button"
          onClick={() => setDeckOpen(true)}
          disabled={heroPicks.length === 0}
          className="font-brand mt-4 rounded-pill bg-accent px-5 py-2.5 text-sm uppercase tracking-wider text-white shadow-sm transition-transform hover:shadow-md active:scale-95 disabled:opacity-40"
        >
          ⤮ Surprise me
        </button>
      </div>

      {/* For You — driven entirely by the user's own Settings interests, no
          presets, no trending fetch. Tapping one narrows Today's Picks to
          just that interest; "For you" clears back to the full blend. */}
      <section className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          <SectionLabel>For You</SectionLabel>
          <MachineLabel>from your interests</MachineLabel>
        </div>
        {interests.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Add interests in{" "}
            <a href="/settings" className="text-foreground underline underline-offset-2">
              Settings
            </a>{" "}
            to personalize this feed.
          </p>
        ) : (
          <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:-mx-8 sm:px-8">
            <TopicChip label="For you" active={topic === null} onClick={() => setTopic(null)} />
            {interests.map((i) => (
              <TopicChip
                key={i}
                label={i}
                active={topic === i}
                onClick={() => setTopic((cur) => (cur === i ? null : i))}
              />
            ))}
          </div>
        )}
      </section>

      {/* The payoff: today's picks, several at a glance, each with its reason */}
      <TodaysPicks key={topic ?? "all"} picks={heroPicks} />

      {/* Charts up top for visibility — show boards beside the episode board */}
      <div className="mb-12 grid items-start gap-10 lg:grid-cols-2">
        <Charts />
        <EpisodeCharts />
      </div>

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

      <FloatingSearch />
    </main>
  );
}

/** Nothing-brand topic toggle — sharp edges, monochrome, dot-matrix type. */
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
      data-active={active}
      className="nothing-toggle shrink-0 whitespace-nowrap px-3 py-1.5 text-[11px]"
    >
      {label}
    </button>
  );
}
