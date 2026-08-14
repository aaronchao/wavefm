"use client";

import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { formatTime, PLAYER_ZOOM_SCALE, scrubDeltaSec } from "@/src/core/player/playerMath";
import { DotWaveform } from "./DotWaveform";

type DragState = {
  startX: number;
  startY: number;
  startSec: number;
  fine: boolean;
  previewSec: number;
};

const LONG_PRESS_MS = 400;
/** Movement past this, before the long-press timer fires, cancels fine
 *  mode — a held finger that's already sliding is scrubbing, not zooming. */
const JITTER_PX = 10;

/**
 * The real player's seek surface — same dot-matrix waveform component the
 * mini/preview bars already use ("the same pixel waveform animation" was
 * Aaron's own ask), wrapped in a drag handler. Dragging left/right scrubs
 * across the whole episode; holding still for LONG_PRESS_MS engages
 * "fine" mode — a much smaller slice of the episode per pixel of
 * horizontal movement, for landing on an exact moment — with a bigger
 * scale-up "zoom" cue and a floating time readout. (Was a drag-down
 * gesture; switched to a long hold and made the zoom bigger per Aaron's
 * ask, 2026-08-14 — his reference video never loaded despite retries, so
 * this follows his text description directly.)
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
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const movedRef = useRef(false);

  const displaySec = drag ? drag.previewSec : currentTime;
  const displayProgress = duration > 0 ? displaySec / duration : 0;

  function clearLongPress() {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // A capture failure (rare, but possible — an already-released pointer,
    // certain accessibility input methods) shouldn't take the rest of the
    // gesture down with it; scrubbing still works without capture, just
    // without the browser guaranteeing move/up events stay targeted here.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignored — see above
    }
    movedRef.current = false;
    setDrag({ startX: e.clientX, startY: e.clientY, startSec: currentTime, fine: false, previewSec: currentTime });
    longPressRef.current = setTimeout(() => {
      if (!movedRef.current) setDrag((d) => (d ? { ...d, fine: true } : d));
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag || !containerRef.current) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.fine && (Math.abs(dx) > JITTER_PX || Math.abs(dy) > JITTER_PX)) {
      movedRef.current = true;
    }
    const width = containerRef.current.clientWidth;
    const deltaSec = scrubDeltaSec(dx, width, duration, drag.fine);
    const previewSec = Math.min(Math.max(drag.startSec + deltaSec, 0), duration > 0 ? duration : Infinity);
    setDrag({ ...drag, previewSec });
  }

  function handlePointerUp() {
    clearLongPress();
    if (!drag) return;
    onSeek(drag.previewSec);
    setDrag(null);
  }

  return (
    <div className="select-none">
      <motion.div
        ref={containerRef}
        animate={{ scale: drag?.fine ? PLAYER_ZOOM_SCALE : 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
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
            className="font-brand pointer-events-none absolute -top-7 -translate-x-1/2 whitespace-nowrap rounded-[2px] bg-black/80 px-2 py-1 text-xs font-bold text-white"
            style={{ left: `${displayProgress * 100}%` }}
          >
            {formatTime(drag.previewSec)}
            {drag.fine && <span className="ml-1 font-normal text-white/60">precise</span>}
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
