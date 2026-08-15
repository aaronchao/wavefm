"use client";

import { motion } from "framer-motion";
import type { SavedEpisode } from "@/src/data/repos/savedEpisodesRepo";
import { ArcProgressDial } from "./ArcProgressDial";

const ROW_HEIGHT = 46;

/**
 * The full-screen page a long-hold on the mini widget's left circle opens
 * (Aaron's spec, 2026-08-16). Two stacked wheels: the bottom one is what
 * you actually drag — a vertical reel of your saved episodes, same
 * "rotary tile" wheel visual as the first cut's single-wheel picker —
 * and the top one just shows whichever show the currently-previewed
 * episode belongs to, big and centered, crossfading as you rotate past a
 * show boundary. Aaron: "user only need to rotate the wheel with their
 * thumb on the bottom circle... the upper circle's show name rotary tile
 * will automatically rotate and align... once user release." The whole
 * open→drag→release gesture lives in useRotaryDial.ts, driving `index`
 * here — this component is purely presentational.
 *
 * Below both wheels: the bottom bar Aaron asked for — playlist, speed,
 * and the arc-style seek dial (ArcProgressDial) from his second
 * reference photo, distinct from the wheels above (those pick WHICH
 * episode; this picks WHEN in it).
 */
export function TwoDialPicker({
  list,
  index,
  currentTime,
  duration,
  onSeek,
  playbackRate,
  onCycleSpeed,
  onOpenPlaylist,
  sleepLabel,
  onCycleSleep,
}: {
  list: SavedEpisode[];
  index: number;
  currentTime: number;
  duration: number;
  onSeek: (sec: number) => void;
  playbackRate: number;
  onCycleSpeed: () => void;
  onOpenPlaylist: () => void;
  sleepLabel: string;
  onCycleSleep: () => void;
}) {
  if (list.length === 0) return null;
  const current = list[index];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      className="pointer-events-none fixed inset-0 z-[70] flex touch-none select-none flex-col items-center justify-between bg-black/92 px-6 pb-8 pt-16"
    >
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-2">
        {/* Top dial — passive, just reflects the current show. */}
        <p className="font-brand text-[10px] uppercase tracking-wider text-white/40">Show</p>
        <motion.p
          key={current?.showId ?? current?.showTitle}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
          className="font-brand line-clamp-1 max-w-xs text-center text-xl font-black text-white"
        >
          {current?.showTitle ?? "—"}
        </motion.p>

        <div className="my-4 h-px w-24 bg-white/15" />

        {/* Bottom dial — the one you actually drag. */}
        <p className="font-brand text-[10px] uppercase tracking-wider text-white/40">Episode</p>
        <div className="relative h-[230px] w-full max-w-xs overflow-hidden">
          {list.map((ep, i) => {
            const offset = i - index;
            if (Math.abs(offset) > 2) return null;
            const isCenter = offset === 0;
            return (
              <div
                key={ep.episodeId}
                className="absolute inset-x-0 top-1/2 flex flex-col items-center"
                style={{
                  transform: `translateY(${offset * ROW_HEIGHT - 12}px) scale(${isCenter ? 1 : 0.82})`,
                  opacity: 1 - Math.abs(offset) * 0.32,
                  transition: "transform 150ms, opacity 150ms",
                }}
              >
                <p
                  className={`font-brand line-clamp-1 max-w-xs text-center ${
                    isCenter ? "text-lg font-bold text-white" : "text-sm font-medium text-white/50"
                  }`}
                >
                  {ep.title}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom bar: playlist / speed / arc seek dial. pointer-events-auto
          since the overlay itself is pointer-events-none (so it doesn't
          block the capture-driven drag on the trigger element above it),
          but these controls need their own taps to work. */}
      <div className="pointer-events-auto flex w-full max-w-sm flex-col items-center gap-3">
        <ArcProgressDial currentTime={currentTime} duration={duration} onSeek={onSeek} />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenPlaylist}
            className="font-brand rounded-full border border-white/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white/70 hover:border-white/50 hover:text-white"
          >
            Playlist
          </button>
          <button
            type="button"
            onClick={onCycleSpeed}
            className="font-brand rounded-full border border-white/20 px-3 py-1.5 text-xs font-bold tabular-nums text-white/70 hover:border-white/50 hover:text-white"
          >
            {playbackRate}×
          </button>
          <button
            type="button"
            onClick={onCycleSleep}
            className="font-brand rounded-full border border-white/20 px-3 py-1.5 text-xs font-bold tabular-nums text-white/70 hover:border-white/50 hover:text-white"
          >
            {sleepLabel}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
