"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import type { SimilarShow } from "@/src/data/catalog/types";
import { recordEngagement } from "@/src/data/repos/engagementRepo";
import { saveShow } from "@/src/data/repos/savedShowsRepo";
import { previewShowTopEpisodeMiddle } from "@/src/features/player/preview";
import { CoverTile } from "@/src/ui";
import { MachineLabel } from "./DiscoverPage";
import { EpisodeList } from "./EpisodeList";
import { Evidence } from "./Evidence";

/** Rotate the list so Shuffle surfaces a fresh order, deterministically. */
function rotate<T>(arr: T[], by: number): T[] {
  if (arr.length === 0) return arr;
  const n = ((by % arr.length) + arr.length) % arr.length;
  return [...arr.slice(n), ...arr.slice(0, n)];
}

/**
 * Today's Picks — a playful, Tinder-style swipeable card deck over the
 * recommended shows. Swipe (or use the buttons) right to keep — saves the
 * show and teaches your taste — or left to skip; either way the deck
 * advances and rotates through the recommended set (it loops rather than
 * ending, so there's always another card). Drag physics are framer-motion's
 * `drag`/`useMotionValue` (no raw touch/pointer handling), matching the
 * proven pattern from the Surprise-me deck.
 */
export function TodaysPicks({ picks }: { picks: SimilarShow[] }) {
  const queryClient = useQueryClient();
  const [seed, setSeed] = useState(0);
  const [index, setIndex] = useState(0);
  if (picks.length === 0) return null;

  const order = rotate(picks, seed);
  const current = order[index % order.length];
  const upcoming = order.length > 1 ? order[(index + 1) % order.length] : null;
  const canShuffle = picks.length > 1;

  function decide(dir: "keep" | "skip") {
    if (!current) return;
    if (dir === "keep") {
      void saveShow(current);
      void recordEngagement(current, "like");
      void queryClient.invalidateQueries({ queryKey: ["saved"] });
    } else {
      void recordEngagement(current, "block");
    }
    setIndex((i) => i + 1);
  }

  function shuffle() {
    setSeed((s) => s + 1);
    setIndex(0);
  }

  return (
    <section className="mb-12">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-accent" />
          <MachineLabel>Today’s picks · swipe to decide</MachineLabel>
        </div>
        {canShuffle && (
          <button
            type="button"
            onClick={shuffle}
            className="font-brand rounded-pill border border-surface-border bg-surface px-3 py-1.5 text-xs uppercase tracking-wider text-zinc-500 transition-colors hover:text-foreground active:scale-95"
          >
            ⤮ Shuffle
          </button>
        )}
      </div>

      <div className="relative mx-auto h-[27rem] w-full max-w-md sm:mx-0">
        {upcoming && <PeekCard key={upcoming.id} show={upcoming} />}
        <SwipeCard key={`${current.id}:${index}`} show={current} onDecide={decide} />
      </div>

      <div className="mt-5 flex items-center justify-center gap-4">
        <DeckButton label="Pass on this show" onClick={() => decide("skip")}>
          ✕
        </DeckButton>
        {/* Nothing-brand primary Play — sharp, monochrome, high contrast */}
        <button
          type="button"
          onClick={() => previewShowTopEpisodeMiddle(current)}
          className="font-brand inline-flex items-center gap-2 rounded-[2px] border border-foreground bg-foreground px-5 py-2.5 text-sm font-semibold uppercase tracking-wider text-background transition-colors hover:bg-background hover:text-foreground active:scale-95"
        >
          <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor" aria-hidden>
            <path d="M0 0l10 6-10 6z" />
          </svg>
          Play the talked-about bit
        </button>
        <DeckButton label="Save this show" accent onClick={() => decide("keep")}>
          ♥
        </DeckButton>
      </div>
    </section>
  );
}

function SwipeCard({
  show,
  onDecide,
}: {
  show: SimilarShow;
  onDecide: (dir: "keep" | "skip") => void;
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const rotateZ = useTransform(x, [-220, 220], [-14, 14]);
  const keep = useTransform(x, [30, 130], [0, 1]);
  const skip = useTransform(x, [-130, -30], [1, 0]);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col overflow-y-auto overflow-x-hidden rounded-card border border-surface-border bg-gradient-to-br from-accent-soft/60 to-background p-5 shadow-lg sm:p-6"
      style={reduce ? undefined : { x, rotate: rotateZ }}
      drag={reduce ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={(_, info) => {
        if (info.offset.x > 120) onDecide("keep");
        else if (info.offset.x < -120) onDecide("skip");
      }}
      initial={reduce ? false : { scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
    >
      {!reduce && (
        <>
          <motion.span
            style={{ opacity: keep }}
            className="font-brand pointer-events-none absolute right-4 top-4 rotate-12 rounded-pill border-2 border-accent px-3 py-1 text-sm font-bold uppercase text-accent"
          >
            Keep
          </motion.span>
          <motion.span
            style={{ opacity: skip }}
            className="font-brand pointer-events-none absolute left-4 top-4 -rotate-12 rounded-pill border-2 border-zinc-400 px-3 py-1 text-sm font-bold uppercase text-zinc-400"
          >
            Skip
          </motion.span>
        </>
      )}
      <CoverTile src={show.coverUrl} size={148} className="!h-48 !w-full !rounded-card shadow-md" />
      <MachineLabel className="mt-4">Today’s pick</MachineLabel>
      <h3 className="mt-1 text-2xl font-bold leading-tight">{show.title}</h3>
      <p className="text-sm text-zinc-500">{show.author}</p>
      <Evidence show={show} className="mt-3" />
      <div className="mt-auto flex items-center justify-between pt-3">
        <Link
          href={`/show/${show.id}`}
          className="relative z-10 text-sm font-medium text-zinc-500 hover:text-foreground"
        >
          Full show →
        </Link>
        <p className="font-brand text-[10px] uppercase tracking-[0.18em] text-zinc-400">
          Drag right: keep · Drag left: skip
        </p>
      </div>
      <EpisodeList show={show} />
    </motion.div>
  );
}

/** A dimmed peek of the next card behind the active one — shows what's next. */
function PeekCard({ show }: { show: SimilarShow }) {
  return (
    <div className="absolute inset-0 scale-95 rounded-card border border-surface-border bg-surface/60 p-5 opacity-60 sm:p-6">
      <CoverTile src={show.coverUrl} size={148} className="!h-48 !w-full !rounded-card" />
      <h3 className="mt-4 truncate text-xl font-bold">{show.title}</h3>
    </div>
  );
}

function DeckButton({
  children,
  label,
  accent = false,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex h-12 w-12 items-center justify-center rounded-full border text-lg shadow-sm transition-transform active:scale-90 ${
        accent
          ? "border-accent bg-accent-soft text-accent"
          : "border-surface-border bg-background text-zinc-500"
      }`}
    >
      {children}
    </button>
  );
}
