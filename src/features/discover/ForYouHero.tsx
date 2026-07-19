"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import type { SimilarShow } from "@/src/data/catalog/types";
import { previewShowTopEpisodeMiddle } from "@/src/features/player/preview";
import { RatingBadges } from "@/src/features/show/RatingBadges";
import { Chip, CoverTile } from "@/src/ui";
import { MachineLabel } from "./DiscoverPage";
import { EpisodeList } from "./EpisodeList";
import { useSavedToggle } from "./useSavedToggle";

/**
 * The For-You hero — the payoff of the whole app: the one show the crowd's
 * discussion, ratings and metrics say is worth your time right now, so you
 * don't have to go dig through Reddit and 豆瓣 yourself. Editorial
 * spotlight: big art, the human "why", evidence badges, one tap to hear
 * the talked-about bit, and a Shuffle for a fresh pick. Motion is a treat,
 * not a tax — it all stands down under prefers-reduced-motion.
 */
export function ForYouHero({ picks }: { picks: SimilarShow[] }) {
  // Parent remounts this via `key` when the topic changes, so index resets
  // to the top pick without a setState-in-effect.
  const [index, setIndex] = useState(0);
  if (picks.length === 0) return null;

  const current = picks[Math.min(index, picks.length - 1)];
  const canShuffle = picks.length > 1;
  const shuffle = () => {
    let next = index;
    while (next === index) next = Math.floor(Math.random() * picks.length);
    setIndex(next);
  };

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-accent" />
          <MachineLabel>For you · today’s pick</MachineLabel>
        </div>
        {canShuffle && (
          <button
            type="button"
            onClick={shuffle}
            className="rounded-pill border border-surface-border bg-surface px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-zinc-500 transition-colors hover:text-foreground active:scale-95"
          >
            ⤮ Shuffle
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
        >
          <HeroCard pick={current} rank={index + 1} />
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function HeroCard({ pick, rank }: { pick: SimilarShow; rank: number }) {
  const saved = useSavedToggle(pick);
  return (
    <div className="relative overflow-hidden rounded-card border border-surface-border bg-gradient-to-br from-accent-soft/60 to-background p-5 shadow-sm sm:p-6">
      {/* Signal-Red glow bloom behind the art */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-accent opacity-20 blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute right-5 top-4 font-mono text-6xl font-bold leading-none text-foreground/5"
      >
        {String(rank).padStart(2, "0")}
      </span>

      <div className="relative flex flex-col gap-5 sm:flex-row">
        <div className="relative shrink-0 self-start">
          <CoverTile src={pick.coverUrl} size={148} className="!rounded-card shadow-md" />
          <Equalizer />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-2xl font-bold leading-tight sm:text-3xl">{pick.title}</h3>
          <p className="mt-0.5 text-sm text-zinc-500">{pick.author}</p>

          <div className="mt-3">
            <MachineLabel>Why we picked this for you</MachineLabel>
            <p className="mt-1 font-medium text-accent">{pick.why}</p>
            <div className="mt-2">
              <RatingBadges showId={pick.id} title={pick.title} />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => previewShowTopEpisodeMiddle(pick)}
              className="rounded-pill bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:shadow-md active:scale-95"
            >
              ▶ Play the talked-about bit
            </button>
            <Chip active={saved.saved} onClick={saved.toggle}>
              {saved.saved ? "Saved ✓" : "Save"}
            </Chip>
            <Link
              href={`/show/${pick.id}`}
              className="text-sm font-medium text-zinc-500 hover:text-foreground"
            >
              Full show →
            </Link>
          </div>
        </div>
      </div>

      <EpisodeList show={pick} />
    </div>
  );
}

/** A tiny Signal-Red equalizer — a wink of life, still under reduced-motion. */
function Equalizer() {
  const reduce = useReducedMotion();
  const bars = [0.5, 0.9, 0.65, 1, 0.75];
  return (
    <div
      aria-hidden
      className="absolute -bottom-1.5 left-1/2 flex -translate-x-1/2 items-end gap-[3px] rounded-pill bg-background/90 px-2 py-1 shadow-sm backdrop-blur"
    >
      {bars.map((h, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-accent"
          style={{ height: 12 * h }}
          animate={reduce ? undefined : { scaleY: [h, 0.35, h] }}
          transition={
            reduce
              ? undefined
              : { duration: 0.9 + i * 0.12, repeat: Infinity, ease: "easeInOut" }
          }
        />
      ))}
    </div>
  );
}
