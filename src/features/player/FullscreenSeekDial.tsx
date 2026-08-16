"use client";

import { motion } from "framer-motion";
import { formatTime } from "@/src/core/player/playerMath";
import { ArcDialVisual } from "./ArcDialVisual";

/**
 * The mini player's own seek control, opened by holding the waveform
 * (useHoldSeek.ts drives this — purely presentational here). Separate
 * overlay from TwoDialPicker's rotary show/episode dial, per Aaron's
 * explicit ask that the two triggers not conflict.
 */
export function FullscreenSeekDial({
  previewSec,
  duration,
  fine,
}: {
  previewSec: number;
  duration: number;
  fine: boolean;
}) {
  const progress = duration > 0 ? previewSec / duration : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      className="pointer-events-none fixed inset-0 z-[70] flex touch-none select-none flex-col items-center justify-center gap-4 bg-black/92 px-6"
    >
      <p className="font-brand text-[10px] uppercase tracking-wider text-white/40">Hold and drag to seek</p>
      <p className="font-brand text-5xl font-black tabular-nums text-white">{formatTime(previewSec)}</p>
      {fine && (
        <p className="font-brand -mt-2 text-xs font-bold uppercase tracking-wider text-accent">precise</p>
      )}
      <div className="w-full max-w-sm">
        <ArcDialVisual progress={progress} fine={fine} big durationSec={duration} />
      </div>
      <p className="font-brand text-xs text-white/40">{formatTime(duration)} total</p>
    </motion.div>
  );
}
