"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import type { SimilarShow } from "@/src/data/catalog/types";
import { previewShowTopEpisodeMiddle } from "@/src/features/player/preview";
import { Chip, CoverTile, SettleIn } from "@/src/ui";
import { MachineLabel } from "./DiscoverPage";
import { EpisodeList } from "./EpisodeList";
import { Evidence } from "./Evidence";
import { useSavedToggle } from "./useSavedToggle";

/** Rotate the list so Shuffle surfaces a fresh spotlight + grid, deterministically. */
function rotate<T>(arr: T[], by: number): T[] {
  if (arr.length === 0) return arr;
  const n = ((by % arr.length) + arr.length) % arr.length;
  return [...arr.slice(n), ...arr.slice(0, n)];
}

/**
 * Today's Picks — the payoff, now several at a glance. The #1 gets the
 * spotlight; the next few sit in a grid, each carrying its own reason so
 * you can scan why any of them is worth your time. Shuffle rotates the set.
 */
export function TodaysPicks({ picks }: { picks: SimilarShow[] }) {
  const reduce = useReducedMotion();
  const [seed, setSeed] = useState(0);
  if (picks.length === 0) return null;

  const order = rotate(picks, seed);
  const [hero, ...rest] = order;
  const grid = rest.slice(0, 6);
  const canShuffle = picks.length > 1;

  return (
    <section className="mb-12">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-accent" />
          <MachineLabel>Today’s picks · why we chose them</MachineLabel>
        </div>
        {canShuffle && (
          <button
            type="button"
            onClick={() => setSeed((s) => s + 1)}
            className="font-brand rounded-pill border border-surface-border bg-surface px-3 py-1.5 text-xs uppercase tracking-wider text-zinc-500 transition-colors hover:text-foreground active:scale-95"
          >
            ⤮ Shuffle
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={hero.id}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -8 }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 30 }}
        >
          <Spotlight pick={hero} />
        </motion.div>
      </AnimatePresence>

      {grid.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {grid.map((pick, i) => (
            <SettleIn key={pick.id} transition={{ delay: Math.min(i * 0.04, 0.3) }}>
              <PickCard pick={pick} rank={i + 2} />
            </SettleIn>
          ))}
        </div>
      )}
    </section>
  );
}

/** The #1 pick — oversized, evidence-forward, one-tap to the talked-about bit. */
function Spotlight({ pick }: { pick: SimilarShow }) {
  const saved = useSavedToggle(pick);
  const reduce = useReducedMotion();
  return (
    <div className="relative overflow-hidden rounded-card border border-surface-border bg-gradient-to-br from-accent-soft/60 to-background p-5 shadow-sm sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-accent opacity-20 blur-3xl"
      />
      <span
        aria-hidden
        className="font-brand pointer-events-none absolute right-5 top-4 text-6xl font-bold leading-none text-foreground/5"
      >
        01
      </span>
      <div className="relative flex flex-col gap-5 sm:flex-row">
        <div className="relative shrink-0 self-start">
          <CoverTile src={pick.coverUrl} size={148} className="!rounded-card shadow-md" />
          <Equalizer reduce={reduce} />
        </div>
        <div className="min-w-0 flex-1">
          <MachineLabel>Rank 01 · today’s top pick</MachineLabel>
          <h3 className="mt-1 text-2xl font-bold leading-tight sm:text-3xl">{pick.title}</h3>
          <p className="mt-0.5 text-sm text-zinc-500">{pick.author}</p>
          <Evidence show={pick} className="mt-3" />
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

/** A compact today's-pick — cover, title, and its reason at a glance. */
function PickCard({ pick, rank }: { pick: SimilarShow; rank: number }) {
  const saved = useSavedToggle(pick);
  return (
    <div className="flex gap-3 rounded-card border border-surface-border bg-background p-3 shadow-sm">
      <span className="font-brand w-6 shrink-0 pt-1 text-center text-sm font-bold text-zinc-300 dark:text-zinc-600">
        {String(rank).padStart(2, "0")}
      </span>
      <CoverTile src={pick.coverUrl} size={56} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{pick.title}</p>
        <p className="truncate text-sm text-zinc-500">{pick.author}</p>
        <Evidence show={pick} className="mt-1" />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => previewShowTopEpisodeMiddle(pick)}
            aria-label={`Play the most-discussed bit of ${pick.title}`}
            className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-transform active:scale-95"
          >
            ▶ Play
          </button>
          <Chip active={saved.saved} onClick={saved.toggle} className="!py-1 !text-xs">
            {saved.saved ? "Saved ✓" : "Save"}
          </Chip>
        </div>
      </div>
    </div>
  );
}

function Equalizer({ reduce }: { reduce: boolean | null }) {
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
            reduce ? undefined : { duration: 0.9 + i * 0.12, repeat: Infinity, ease: "easeInOut" }
          }
        />
      ))}
    </div>
  );
}
