"use client";

import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { formatTime, isFineScrubEngaged, scrubDeltaSec } from "@/src/core/player/playerMath";
import { DotWaveform } from "./DotWaveform";

type DragState = {
  startX: number;
  startY: number;
  startSec: number;
  fine: boolean;
  previewSec: number;
};

/**
 * The real player's seek surface — same dot-matrix waveform component the
 * mini/preview bars already use ("the same pixel waveform animation" was
 * Aaron's own ask), wrapped in a drag handler. Dragging left/right scrubs
 * across the whole episode; dragging down while doing it engages "fine"
 * mode — a much smaller slice of the episode per pixel of horizontal
 * movement, for landing on an exact moment — with a scale-up "zoom" cue
 * and a floating time readout, mirroring the drag-down-to-slow-scrub
 * gesture from Voice Memos / Apple Podcasts.
 */
export function PlayerWaveformScrubber({
  active,
  currentTime,
  duration,
  onSeek,
}: {
  active: boolean;
  currentTime: number;
  duration: number;
  onSeek: (sec: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const displaySec = drag ? drag.previewSec : currentTime;
  const displayProgress = duration > 0 ? displaySec / duration : 0;

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ startX: e.clientX, startY: e.clientY, startSec: currentTime, fine: false, previewSec: currentTime });
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag || !containerRef.current) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const fine = isFineScrubEngaged(dy);
    const width = containerRef.current.clientWidth;
    const deltaSec = scrubDeltaSec(dx, width, duration, fine);
    const previewSec = Math.min(Math.max(drag.startSec + deltaSec, 0), duration > 0 ? duration : Infinity);
    setDrag({ ...drag, fine, previewSec });
  }

  function handlePointerUp() {
    if (!drag) return;
    onSeek(drag.previewSec);
    setDrag(null);
  }

  return (
    <div className="select-none">
      <motion.div
        ref={containerRef}
        animate={{ scale: drag?.fine ? 1.08 : 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="relative touch-none py-2"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <DotWaveform active={active} progress={displayProgress} className="h-10" />
        {drag && (
          <div
            aria-hidden
            className="font-brand pointer-events-none absolute -top-6 -translate-x-1/2 whitespace-nowrap rounded-[2px] bg-black/80 px-2 py-0.5 text-[11px] font-bold text-white"
            style={{ left: `${displayProgress * 100}%` }}
          >
            {formatTime(drag.previewSec)}
            {drag.fine && <span className="ml-1 font-normal text-white/60">fine</span>}
          </div>
        )}
      </motion.div>
      <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground">
        <span>{formatTime(displaySec)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
