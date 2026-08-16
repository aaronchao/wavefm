"use client";

import { motion } from "framer-motion";
import type { SavedEpisode } from "@/src/data/repos/savedEpisodesRepo";

const DIAL_SIZE = 240;
const TICK_COUNT = 48;

/**
 * A circular gauge — ring of tick marks, a small indicator dot, big bold
 * centered text — replacing the first cut's vertical text wheel per
 * Aaron's reference photo (2026-08-16): a real dial shape, not a list.
 * `angleDeg` positions the indicator dot around the ring; both dials
 * below share the same angle (index / (length-1) of the episode list)
 * so they visibly rotate together, matching "the upper circle's show
 * name rotary tile will automatically rotate and align."
 */
function CircularNameDial({
  label,
  sublabel,
  angleDeg,
  size = DIAL_SIZE,
}: {
  label: string;
  sublabel?: string;
  angleDeg: number;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 10;
  const rad = (angleDeg * Math.PI) / 180;
  const dot = { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
        <circle cx={cx} cy={cy} r={r} className="fill-none stroke-white/15" strokeWidth={1} />
        {Array.from({ length: TICK_COUNT }, (_, i) => {
          const deg = (i * 360) / TICK_COUNT;
          const tRad = (deg * Math.PI) / 180;
          const major = i % 4 === 0;
          const outerR = r;
          const innerR = r - (major ? 10 : 5);
          return (
            <line
              key={i}
              x1={cx + outerR * Math.sin(tRad)}
              y1={cy - outerR * Math.cos(tRad)}
              x2={cx + innerR * Math.sin(tRad)}
              y2={cy - innerR * Math.cos(tRad)}
              strokeWidth={major ? 1.5 : 1}
              className="stroke-white/20"
            />
          );
        })}
        <motion.circle
          animate={{ cx: dot.x, cy: dot.y }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          r={5}
          className="fill-accent"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
        <p className="font-brand line-clamp-2 text-lg font-black leading-tight text-white">{label}</p>
        {sublabel && <p className="mt-1 line-clamp-1 text-xs text-white/50">{sublabel}</p>}
      </div>
    </div>
  );
}

/**
 * The full-screen page a long-hold on the mini widget's left circle opens
 * (Aaron's spec, 2026-08-16). Two dials: the bottom one is what you
 * actually drag (the episode wheel, driven externally by
 * useRotaryDial.ts via `index`); the top one just shows whichever show
 * the currently-previewed episode belongs to. Both rendered as circular
 * gauges (CircularNameDial above) rather than the first cut's vertical
 * text wheel.
 *
 * Bottom bar: playlist / speed / sleep timer. The seek dial used to live
 * here too, but Aaron asked for it to be its own separate trigger (the
 * mini player's waveform, long-held — see useHoldSeek.ts /
 * FullscreenSeekDial.tsx) since sharing this page's gesture with the
 * episode dial meant you couldn't use either while the other was open.
 */
export function TwoDialPicker({
  list,
  index,
  playbackRate,
  onCycleSpeed,
  onOpenPlaylist,
  sleepLabel,
  onCycleSleep,
}: {
  list: SavedEpisode[];
  index: number;
  playbackRate: number;
  onCycleSpeed: () => void;
  onOpenPlaylist: () => void;
  sleepLabel: string;
  onCycleSleep: () => void;
}) {
  if (list.length === 0) return null;
  const current = list[index];
  const angleDeg = list.length > 1 ? (index / (list.length - 1)) * 300 - 150 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      className="pointer-events-none fixed inset-0 z-[70] flex touch-none select-none flex-col items-center justify-between bg-black/92 px-6 pb-8 pt-16"
    >
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-1">
        <p className="font-brand text-[10px] uppercase tracking-wider text-white/40">Show</p>
        <CircularNameDial label={current?.showTitle ?? "—"} angleDeg={angleDeg} size={180} />

        <p className="font-brand mt-2 text-[10px] uppercase tracking-wider text-white/40">Episode</p>
        <CircularNameDial label={current?.title ?? "—"} sublabel={`${index + 1} of ${list.length}`} angleDeg={angleDeg} />
      </div>

      {/* pointer-events-auto since the overlay itself is pointer-events-none
          (so it doesn't block the capture-driven drag on the trigger
          element above it), but these controls need their own taps to work. */}
      <div className="pointer-events-auto flex items-center gap-3">
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
    </motion.div>
  );
}
