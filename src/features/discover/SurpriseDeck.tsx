"use client";

import { motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { SimilarShow } from "@/src/data/catalog/types";
import { recordEngagement } from "@/src/data/repos/engagementRepo";
import { saveShow } from "@/src/data/repos/savedShowsRepo";
import { previewShowTopEpisodeMiddle } from "@/src/features/player/preview";
import { CoverTile } from "@/src/ui";
import { Evidence } from "./Evidence";

/**
 * Surprise-me — a keep-or-skip card game over the discussion-first picks.
 * Swipe (or tap ✕ / ♥) to blow through hidden gems fast; keeping saves the
 * show and teaches your taste, skipping tunes it the other way. Playful by
 * design, but fully operable with buttons under prefers-reduced-motion.
 */
export function SurpriseDeck({
  picks,
  onClose,
}: {
  picks: SimilarShow[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [kept, setKept] = useState(0);
  const current = picks[index];
  const next = picks[index + 1];

  function decide(dir: "keep" | "skip") {
    const show = picks[index];
    if (!show) return;
    if (dir === "keep") {
      void saveShow(show);
      void recordEngagement(show, "like");
      void queryClient.invalidateQueries({ queryKey: ["saved"] });
      setKept((k) => k + 1);
    } else {
      void recordEngagement(show, "block");
    }
    setIndex((i) => i + 1);
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-background/80 p-4 backdrop-blur">
      <div className="mb-4 flex w-full max-w-sm items-center justify-between">
        <span className="font-brand text-sm uppercase tracking-[0.18em] text-accent">
          ⤮ Surprise me
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-2 py-1 text-zinc-400 hover:text-foreground"
          aria-label="Close"
        >
          ✕ Done{kept > 0 ? ` · ${kept} saved` : ""}
        </button>
      </div>

      <div className="relative h-[26rem] w-full max-w-sm">
        {current ? (
          <>
            {next && <PeekCard key={next.id} show={next} />}
            <SwipeCard key={current.id} show={current} onDecide={decide} />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-card border border-surface-border bg-background p-6 text-center">
            <p className="font-brand text-lg">That’s everyone for now</p>
            <p className="mt-1 text-sm text-zinc-500">
              {kept > 0 ? `You saved ${kept}. They’re in your Library.` : "Come back later for fresh gems."}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 rounded-pill bg-accent px-5 py-2.5 text-sm font-semibold text-white active:scale-95"
            >
              Back to Discover
            </button>
          </div>
        )}
      </div>

      {current && (
        <div className="mt-5 flex items-center gap-5">
          <DeckButton label="Skip" onClick={() => decide("skip")}>
            ✕
          </DeckButton>
          <button
            type="button"
            onClick={() => previewShowTopEpisodeMiddle(current)}
            className="rounded-full bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm active:scale-95"
          >
            ▶ Play
          </button>
          <DeckButton label="Keep" accent onClick={() => decide("keep")}>
            ♥
          </DeckButton>
        </div>
      )}
    </div>
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
  const rotate = useTransform(x, [-220, 220], [-14, 14]);
  const keep = useTransform(x, [30, 130], [0, 1]);
  const skip = useTransform(x, [-130, -30], [1, 0]);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col rounded-card border border-surface-border bg-background p-5 shadow-lg"
      style={reduce ? undefined : { x, rotate }}
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
            className="font-brand absolute right-4 top-4 rotate-12 rounded-pill border-2 border-accent px-3 py-1 text-sm font-bold uppercase text-accent"
          >
            Keep
          </motion.span>
          <motion.span
            style={{ opacity: skip }}
            className="font-brand absolute left-4 top-4 -rotate-12 rounded-pill border-2 border-zinc-400 px-3 py-1 text-sm font-bold uppercase text-zinc-400"
          >
            Skip
          </motion.span>
        </>
      )}
      <CoverTile src={show.coverUrl} size={120} className="!h-40 !w-full !rounded-tile" />
      <h3 className="mt-4 text-xl font-bold leading-tight">{show.title}</h3>
      <p className="text-sm text-zinc-500">{show.author}</p>
      <Evidence show={show} className="mt-3" />
      <p className="mt-auto pt-3 text-center font-brand text-[10px] uppercase tracking-[0.18em] text-zinc-400">
        Swipe → keep · ← skip
      </p>
    </motion.div>
  );
}

/** A dimmed peek of the next card behind the active one. */
function PeekCard({ show }: { show: SimilarShow }) {
  return (
    <div className="absolute inset-0 scale-95 rounded-card border border-surface-border bg-surface/60 p-5 opacity-60">
      <CoverTile src={show.coverUrl} size={120} className="!h-40 !w-full !rounded-tile" />
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
      className={`flex h-14 w-14 items-center justify-center rounded-full border text-xl shadow-sm transition-transform active:scale-90 ${
        accent
          ? "border-accent bg-accent-soft text-accent"
          : "border-surface-border bg-background text-zinc-500"
      }`}
    >
      {children}
    </button>
  );
}
