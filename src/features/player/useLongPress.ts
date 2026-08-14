"use client";

import { useRef } from "react";

const DEFAULT_MS = 450;
const JITTER_PX = 10;

/**
 * Fires `onLongPress` after holding still for `ms` — used for the rotary
 * dial trigger (long-press cover art / show name / episode title) and
 * shares the same "held still, not sliding" jitter check as the
 * waveform's own long-press-to-zoom (PlayerWaveformScrubber.tsx).
 */
export function useLongPress(onLongPress: () => void, ms = DEFAULT_MS) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const firedRef = useRef(false);

  function clear() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    startRef.current = { x: e.clientX, y: e.clientY };
    firedRef.current = false;
    clear();
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      onLongPress();
    }, ms);
  }

  function onPointerMove(e: React.PointerEvent) {
    const dx = Math.abs(e.clientX - startRef.current.x);
    const dy = Math.abs(e.clientY - startRef.current.y);
    if (dx > JITTER_PX || dy > JITTER_PX) clear();
  }

  return {
    // Spread onto a DOM element: {...handlers}. Kept separate from
    // didLongPress below — spreading the whole return value would leak
    // didLongPress itself as an invalid DOM attribute.
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: clear,
      onPointerLeave: clear,
      onPointerCancel: clear,
    },
    /** True if the long-press already fired for the gesture in progress —
     *  callers can use this to swallow the trailing click (e.g. the play
     *  button under the same pointer) if needed. */
    didLongPress: () => firedRef.current,
  };
}
