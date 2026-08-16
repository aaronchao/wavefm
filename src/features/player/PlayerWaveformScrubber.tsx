"use client";

import { formatTime } from "@/src/core/player/playerMath";
import { DotWaveform } from "./DotWaveform";

/**
 * The real player's seek surface — same dot-matrix waveform component the
 * mini/preview bars already use. Purely presentational now: gesture
 * ownership (quick drag = instant scrub, hold still = opens the
 * fullscreen arc dial) moved to useHoldSeek.ts, wired at the call site
 * (FullPlayer.tsx), so this component just renders whatever time it's
 * told — `displaySec` is either the live drag preview or the real
 * playhead, the caller decides which.
 */
export function PlayerWaveformScrubber({
  active,
  displaySec,
  duration,
  dragging,
}: {
  active: boolean;
  displaySec: number;
  duration: number;
  dragging?: boolean;
}) {
  const progress = duration > 0 ? displaySec / duration : 0;

  return (
    <div className="select-none">
      <div className="relative py-2">
        <DotWaveform active={active} progress={progress} className="h-10" />
        {dragging && (
          <div
            aria-hidden
            className="font-brand pointer-events-none absolute -top-7 -translate-x-1/2 whitespace-nowrap rounded-[2px] bg-black/80 px-2 py-1 text-xs font-bold text-white"
            style={{ left: `${progress * 100}%` }}
          >
            {formatTime(displaySec)}
          </div>
        )}
      </div>
      <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground">
        <span>{formatTime(displaySec)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
