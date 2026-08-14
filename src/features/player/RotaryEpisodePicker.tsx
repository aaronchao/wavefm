"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { listSavedEpisodes } from "@/src/data/repos/savedEpisodesRepo";
import { fullPlayer } from "@/src/state/fullPlayer";

const ROW_HEIGHT = 46;

/**
 * Long-press the cover art, show name, or episode title in the full
 * player to bring this up — a wheel of your other saved episodes, drag
 * up/down to rotate through them, release to switch. Built from Aaron's
 * reference image (a dual-column iOS-style number wheel) plus his text
 * description, since the video he referenced for this never loaded
 * despite retries (2026-08-14).
 *
 * Simplification worth flagging: his description implies two
 * independently meaningful columns (show side / episode side); read
 * literally it's internally ambiguous about which side does what. Built
 * as ONE wheel — the show name big and bold in the center, the episode
 * title as a small caption below it, both updating together as you
 * rotate — rather than guess at two separate, independently-rotating
 * columns. Say so if you want it split into two.
 */
export function RotaryEpisodePicker({
  currentEpisodeId,
  onClose,
}: {
  currentEpisodeId: string;
  onClose: () => void;
}) {
  const episodesQ = useQuery({
    queryKey: ["savedEpisodes"],
    queryFn: listSavedEpisodes,
    staleTime: 60_000,
  });
  const list = (episodesQ.data ?? [])
    .filter((e) => e.bucket === "queue" && e.status !== "finished" && e.audioUrl)
    .sort((a, b) => (a.queueRank ?? 0) - (b.queueRank ?? 0));

  const startIndex = Math.max(
    0,
    list.findIndex((e) => e.episodeId === currentEpisodeId),
  );
  const [index, setIndex] = useState(startIndex);
  const dragStartY = useRef(0);
  const dragStartIndex = useRef(startIndex);

  function handlePointerDown(e: React.PointerEvent) {
    // See PlayerWaveformScrubber.tsx — a capture failure shouldn't abort
    // the rest of the gesture.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignored
    }
    dragStartY.current = e.clientY;
    dragStartIndex.current = index;
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (list.length === 0) return;
    const dy = e.clientY - dragStartY.current;
    // Drag up rotates forward (like pulling a real wheel toward you).
    const steps = Math.round(-dy / ROW_HEIGHT);
    setIndex(Math.min(list.length - 1, Math.max(0, dragStartIndex.current + steps)));
  }

  function handlePointerUp() {
    const chosen = list[index];
    if (chosen?.audioUrl) {
      fullPlayer.open(
        {
          episodeId: chosen.episodeId,
          title: chosen.title,
          showId: chosen.showId,
          showTitle: chosen.showTitle,
          coverUrl: chosen.coverUrl,
          audioUrl: chosen.audioUrl,
          durationSec: chosen.durationSec,
        },
        chosen.positionSec,
      );
    }
    onClose();
  }

  if (list.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      className="fixed inset-0 z-[70] flex touch-none select-none flex-col items-center justify-center bg-black/92 px-6"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <p className="font-brand mb-6 text-xs uppercase tracking-wider text-white/50">
        Drag to choose · release to switch
      </p>
      <div className="relative h-[230px] w-full max-w-xs overflow-hidden">
        {list.map((ep, i) => {
          const offset = i - index;
          if (Math.abs(offset) > 2) return null;
          const isCenter = offset === 0;
          return (
            <div
              key={ep.episodeId}
              className="absolute inset-x-0 top-1/2 flex flex-col items-center transition-transform duration-150"
              style={{
                transform: `translateY(${offset * ROW_HEIGHT - 12}px) scale(${isCenter ? 1 : 0.82})`,
                opacity: 1 - Math.abs(offset) * 0.32,
              }}
            >
              <p
                className={`font-brand line-clamp-1 max-w-xs text-center ${
                  isCenter ? "text-2xl font-black text-white" : "text-base font-bold text-white/50"
                }`}
              >
                {ep.showTitle ?? ep.title}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-6 line-clamp-2 max-w-xs text-center text-sm text-white/70">{list[index]?.title}</p>
      <button
        type="button"
        onClick={onClose}
        // Stop the pointer events here so they don't bubble to the
        // overlay's own onPointerUp — a tap-through would otherwise both
        // commit whatever episode is currently indexed AND close.
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        className="font-brand mt-8 text-xs uppercase tracking-wider text-white/50 hover:text-white"
      >
        Cancel
      </button>
    </motion.div>
  );
}
