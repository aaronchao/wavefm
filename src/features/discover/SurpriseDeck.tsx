"use client";

import { motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { CatalogEpisode } from "@/src/data/catalog/types";
import { saveEpisode } from "@/src/data/repos/savedEpisodesRepo";
import { previewEpisode } from "@/src/features/player/preview";
import { player } from "@/src/state/player";
import { CoverTile } from "@/src/ui";
import { useInterestEpisodes } from "./useInterestEpisodes";

/**
 * Wavr — a swipe-only keep-or-skip game over the "For You" episodes, sourced
 * straight from the interest tags in that section (not the ranked-shows list).
 * Each card is a single episode that auto-plays through the app-wide Play Bar
 * the moment it's on top (one source plays at a time, everywhere): swipe right
 * to keep it (queues it into your Library), left to skip. Fully gesture-driven;
 * a reduced-motion viewer keeps/skips via the header shortcut instead.
 */
export function SurpriseDeck({
  terms,
  onClose,
}: {
  /** The active "For You" interest lenses — the deck's episode pool. */
  terms: string[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { episodes, isLoading } = useInterestEpisodes(terms, { perTerm: 8 });

  const [index, setIndex] = useState(0);
  const [kept, setKept] = useState(0);
  const current = episodes[index];
  const next = episodes[index + 1];
  const loading = isLoading && episodes.length === 0;

  function decide(dir: "keep" | "skip") {
    const ep = episodes[index];
    if (!ep) return;
    if (dir === "keep") {
      void saveEpisode({
        id: ep.id,
        title: ep.title,
        showId: ep.showId,
        showTitle: ep.showTitle,
        coverUrl: ep.coverUrl,
        appleUrl: ep.appleUrl,
        audioUrl: ep.audioUrl,
        durationSec: ep.durationSec,
        publishedAt: ep.publishedAt,
        categories: ep.categories ?? [],
      });
      void queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] });
      setKept((k) => k + 1);
    }
    setIndex((i) => i + 1);
  }

  function close() {
    player.dismiss(); // stop the auto-playing snippet as the deck leaves
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-background/80 p-4 backdrop-blur">
      <div className="mb-4 flex w-full max-w-sm items-center justify-between">
        <span className="font-brand text-sm uppercase tracking-[0.18em] text-accent">Wavr</span>
        <button
          type="button"
          onClick={close}
          className="rounded-full px-2 py-1 text-zinc-400 hover:text-foreground"
          aria-label="Close"
        >
          ✕ Done{kept > 0 ? ` · ${kept} saved` : ""}
        </button>
      </div>

      <div className="relative h-[26rem] w-full max-w-sm">
        {loading ? (
          <div className="flex h-full items-center justify-center rounded-card border border-surface-border bg-background">
            <p className="text-sm text-zinc-400">Finding episodes for you…</p>
          </div>
        ) : current ? (
          <>
            {next && <PeekCard key={next.id} ep={next} />}
            <SwipeCard key={current.id} ep={current} onDecide={decide} />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-card border border-surface-border bg-background p-6 text-center">
            <p className="font-brand text-lg">That’s everyone for now</p>
            <p className="mt-1 text-sm text-zinc-500">
              {kept > 0 ? `You saved ${kept}. They’re in your Library.` : "Come back later for fresh gems."}
            </p>
            <button
              type="button"
              onClick={close}
              className="mt-4 rounded-pill bg-accent px-5 py-2.5 text-sm font-semibold text-white active:scale-95"
            >
              Back to Discover
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SwipeCard({
  ep,
  onDecide,
}: {
  ep: CatalogEpisode;
  onDecide: (dir: "keep" | "skip") => void;
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-14, 14]);
  const keep = useTransform(x, [30, 130], [0, 1]);
  const skip = useTransform(x, [-130, -30], [1, 0]);
  const blurb = plainText(ep.description);

  // Auto-play the episode through the app-wide Play Bar as the card lands.
  useEffect(() => {
    previewEpisode({ ...ep, categories: ep.categories ?? [] });
  }, [ep]);

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
      <CoverTile src={ep.coverUrl} size={120} className="!h-40 !w-full !rounded-tile" />
      <h3 className="mt-4 text-xl font-bold leading-tight line-clamp-2">{ep.title}</h3>
      {ep.showTitle && <p className="text-sm text-zinc-500">{ep.showTitle}</p>}
      {blurb ? (
        <blockquote className="mt-3 border-l-2 border-accent-soft pl-3 text-sm italic text-foreground/80 line-clamp-4">
          {blurb}
        </blockquote>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">▶ Playing a preview — swipe if it clicks.</p>
      )}
      <p className="mt-auto pt-3 text-center font-brand text-[10px] uppercase tracking-[0.18em] text-zinc-400">
        Swipe → keep · ← skip
      </p>
    </motion.div>
  );
}

/** A dimmed peek of the next card behind the active one. */
function PeekCard({ ep }: { ep: CatalogEpisode }) {
  return (
    <div className="absolute inset-0 scale-95 rounded-card border border-surface-border bg-surface/60 p-5 opacity-60">
      <CoverTile src={ep.coverUrl} size={120} className="!h-40 !w-full !rounded-tile" />
      <h3 className="mt-4 truncate text-xl font-bold">{ep.title}</h3>
    </div>
  );
}

/** Strip HTML tags/entities from a feed description for a clean card blurb. */
function plainText(html?: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
