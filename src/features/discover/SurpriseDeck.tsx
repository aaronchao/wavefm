"use client";

import { motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getRankedEpisodes } from "@/src/data/catalog/client";
import type { RankedEpisodeItem, SimilarShow } from "@/src/data/catalog/types";
import { recordEngagement } from "@/src/data/repos/engagementRepo";
import { saveShow } from "@/src/data/repos/savedShowsRepo";
import { previewRankedEpisode } from "@/src/features/player/preview";
import { CoverTile } from "@/src/ui";

/** One "episode to try" card — a ranked episode paired with its show. */
type TryCard = { show: SimilarShow; episode: RankedEpisodeItem };

/**
 * Wavr — a swipe-only keep-or-skip game over the "For You" episodes-to-try
 * pool. Each card auto-plays through the app-wide Play Bar the moment it's
 * on top (never its own <audio> — one source plays at a time, everywhere)
 * and surfaces a real community quote instead of a play/skip/keep button
 * row: swipe right to keep the show (saves it, teaches your taste), left to
 * skip. Fully gesture-driven; a reduced-motion viewer still keeps/skips via
 * the header shortcut, since dragging is unavailable.
 */
export function SurpriseDeck({
  picks,
  onClose,
}: {
  picks: SimilarShow[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const topShows = picks.slice(0, 8);
  const episodeQueries = useQueries({
    queries: topShows.map((show) => ({
      queryKey: ["catalog", "episodes-ranked", show.id],
      queryFn: () => getRankedEpisodes(show.id),
      staleTime: 6 * 60 * 60 * 1000,
    })),
  });

  // "Episode to try" pool — one ranked episode per show, paired together.
  const cards: TryCard[] = episodeQueries
    .map((q, i) => ({ show: topShows[i], episode: q.data?.[0] }))
    .filter((c): c is TryCard => Boolean(c.episode));

  const [index, setIndex] = useState(0);
  const [kept, setKept] = useState(0);
  const current = cards[index];
  const next = cards[index + 1];
  const loading = episodeQueries.some((q) => q.isLoading) && cards.length === 0;

  function decide(dir: "keep" | "skip") {
    const show = cards[index]?.show;
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
        <span className="font-brand text-sm uppercase tracking-[0.18em] text-accent">Wavr</span>
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
        {loading ? (
          <div className="flex h-full items-center justify-center rounded-card border border-surface-border bg-background">
            <p className="text-sm text-zinc-400">Finding episodes to try…</p>
          </div>
        ) : current ? (
          <>
            {next && <PeekCard key={`${next.show.id}:${next.episode.id}`} card={next} />}
            <SwipeCard key={`${current.show.id}:${current.episode.id}`} card={current} onDecide={decide} />
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
    </div>
  );
}

/** The real community line behind a pick — evidence when we have it, the
 *  episode's own "why" (also straight from the payload) when we don't. */
function quoteFor(card: TryCard): { quote: string; communityUsername: string } {
  const evidence = card.show.evidence?.[0];
  if (evidence) return { quote: evidence.text, communityUsername: evidence.source };
  return { quote: card.episode.why, communityUsername: card.show.why || "the community" };
}

function SwipeCard({
  card,
  onDecide,
}: {
  card: TryCard;
  onDecide: (dir: "keep" | "skip") => void;
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-14, 14]);
  const keep = useTransform(x, [30, 130], [0, 1]);
  const skip = useTransform(x, [-130, -30], [1, 0]);
  const { quote, communityUsername } = quoteFor(card);

  // Auto-play through the app-wide Play Bar the moment this card is on top.
  useEffect(() => {
    previewRankedEpisode(card.episode, card.show);
  }, [card]);

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
      <CoverTile src={card.show.coverUrl} size={120} className="!h-40 !w-full !rounded-tile" />
      <h3 className="mt-4 text-xl font-bold leading-tight">{card.show.title}</h3>
      <p className="text-sm text-zinc-500">{card.episode.title}</p>
      <blockquote className="mt-3 border-l-2 border-accent-soft pl-3 text-sm italic text-foreground/80">
        “{quote}”
      </blockquote>
      <p className="font-brand mt-1 text-[11px] uppercase tracking-wider text-accent">
        — {communityUsername}
      </p>
      <p className="mt-auto pt-3 text-center font-brand text-[10px] uppercase tracking-[0.18em] text-zinc-400">
        Swipe → keep · ← skip
      </p>
    </motion.div>
  );
}

/** A dimmed peek of the next card behind the active one. */
function PeekCard({ card }: { card: TryCard }) {
  return (
    <div className="absolute inset-0 scale-95 rounded-card border border-surface-border bg-surface/60 p-5 opacity-60">
      <CoverTile src={card.show.coverUrl} size={120} className="!h-40 !w-full !rounded-tile" />
      <h3 className="mt-4 truncate text-xl font-bold">{card.show.title}</h3>
    </div>
  );
}
