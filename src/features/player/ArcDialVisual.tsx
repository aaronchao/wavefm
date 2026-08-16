"use client";

import { motion } from "framer-motion";
import { formatTime, PLAYER_ZOOM_SCALE } from "@/src/core/player/playerMath";

// Arc geometry — a shallow downward "smile" like a radio tuning gauge
// (Aaron's reference photos, 2026-08-16). Center sits above the viewBox;
// only the bottom slice of the circle is visible.
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
 * Pure visual — the arc, its tick marks (every 4th one longer, and
 * labeled with a rough time when `big` is set, echoing the reference's
 * "86 87 [88] 89 90 91" frequency labels), and a pill-shaped thumb. No
 * gesture handling of its own — FullscreenSeekDial.tsx (driven by
 * useHoldSeek.ts) renders this from whatever progress value it's
 * tracking.
 */
export function ArcDialVisual({
  progress,
  fine,
  big,
  durationSec,
}: {
  /** 0..1 through the episode. */
  progress: number;
  /** Bigger scale + thicker thumb while precision-scrubbing. */
  fine?: boolean;
  /** Bigger tick labels, matching the fullscreen reference exactly. */
  big?: boolean;
  /** Used to compute rough tick-label times when `big`. */
  durationSec?: number;
}) {
  const angle = -ANGLE_SPAN + Math.min(Math.max(progress, 0), 1) * ANGLE_SPAN * 2;
  const thumb = pointOnArc(angle);
  const ticks = Array.from({ length: 17 }, (_, i) => -ANGLE_SPAN + (i * (ANGLE_SPAN * 2)) / 16);

  return (
    <motion.div
      animate={{ scale: fine ? PLAYER_ZOOM_SCALE : 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="relative touch-none select-none"
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} aria-hidden>
        {ticks.map((t, i) => {
          const major = i % 4 === 0;
          const outer = pointOnArc(t, R);
          const inner = pointOnArc(t, R - (major ? 14 : 8));
          const played = t <= angle;
          return (
            <g key={i}>
              <line
                x1={outer.x}
                y1={outer.y}
                x2={inner.x}
                y2={inner.y}
                strokeWidth={major ? 2 : 1}
                className={played ? "stroke-accent" : "stroke-surface-border"}
              />
              {big && major && durationSec && durationSec > 0 && (
                <text
                  x={pointOnArc(t, R - 30).x}
                  y={pointOnArc(t, R - 30).y}
                  textAnchor="middle"
                  className="fill-muted-foreground font-brand text-[10px]"
                >
                  {formatTime(((t + ANGLE_SPAN) / (ANGLE_SPAN * 2)) * durationSec)}
                </text>
              )}
            </g>
          );
        })}
        {/* Pill thumb — a rounded rect rotated to sit tangent to the arc,
            echoing the reference's white capsule marker. */}
        <rect
          x={thumb.x - (fine ? 10 : 8)}
          y={thumb.y - (fine ? 16 : 13)}
          width={fine ? 20 : 16}
          height={fine ? 32 : 26}
          rx={fine ? 10 : 8}
          transform={`rotate(${angle} ${thumb.x} ${thumb.y})`}
          className="fill-accent"
        />
      </svg>
    </motion.div>
  );
}
