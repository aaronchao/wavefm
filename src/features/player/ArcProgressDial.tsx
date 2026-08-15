"use client";

import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { formatTime, PLAYER_ZOOM_SCALE, scrubDeltaSec } from "@/src/core/player/playerMath";

type DragState = {
  startX: number;
  startY: number;
  startSec: number;
  fine: boolean;
  previewSec: number;
};

const LONG_PRESS_MS = 400;
const JITTER_PX = 10;

// Arc geometry — a shallow downward "smile" like a radio tuning gauge
// (Aaron's second reference photo, 2026-08-16). Center sits above the
// viewBox; only the bottom slice of the circle is visible.
const W = 320;
const H = 150;
const CX = W / 2;
const CY = -70;
const R = 210;
const ANGLE_SPAN = 32; // degrees each side of straight-down

function pointOnArc(angleDeg: number, radius = R) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.sin(rad), y: CY + radius * Math.cos(rad) };
}

/**
 * The rotary page's own seek control — a curved dial instead of the mini
 * widget's straight waveform scrubber, matching Aaron's radio-tuner
 * reference. Same drag-to-seek and hold-still-to-zoom behavior as
 * PlayerWaveformScrubber (shared math from playerMath.ts), just laid out
 * along an arc instead of a line.
 */
export function ArcProgressDial({
  currentTime,
  duration,
  onSeek,
}: {
  currentTime: number;
  duration: number;
  onSeek: (sec: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const movedRef = useRef(false);

  const displaySec = drag ? drag.previewSec : currentTime;
  const displayProgress = duration > 0 ? Math.min(Math.max(displaySec / duration, 0), 1) : 0;
  const angle = -ANGLE_SPAN + displayProgress * ANGLE_SPAN * 2;
  const thumb = pointOnArc(angle);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // see PlayerWaveformScrubber.tsx — a capture failure shouldn't abort the gesture
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
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
    if (!drag) return;
    onSeek(drag.previewSec);
    setDrag(null);
  }

  const ticks = Array.from({ length: 17 }, (_, i) => -ANGLE_SPAN + (i * (ANGLE_SPAN * 2)) / 16);

  return (
    <div className="select-none">
      <motion.div
        ref={containerRef}
        animate={{ scale: drag?.fine ? PLAYER_ZOOM_SCALE : 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="relative touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} aria-hidden>
          {ticks.map((t, i) => {
            const outer = pointOnArc(t, R);
            const inner = pointOnArc(t, R - (i % 4 === 0 ? 14 : 8));
            const played = t <= angle;
            return (
              <line
                key={i}
                x1={outer.x}
                y1={outer.y}
                x2={inner.x}
                y2={inner.y}
                strokeWidth={i % 4 === 0 ? 2 : 1}
                className={played ? "stroke-accent" : "stroke-surface-border"}
              />
            );
          })}
          <circle cx={thumb.x} cy={thumb.y} r={7} className="fill-accent" />
        </svg>
        {drag && (
          <div
            aria-hidden
            className="font-brand pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap rounded-[2px] bg-black/80 px-2 py-1 text-xs font-bold text-white"
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
