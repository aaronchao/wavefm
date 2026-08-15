"use client";

import { useRef, useState } from "react";

const LONG_PRESS_MS = 400;
const JITTER_PX = 10;
const ROW_HEIGHT = 46;

/**
 * The whole rotary-dial gesture as ONE continuous pointer session —
 * Aaron's own spec (2026-08-16): "this page only gets triggered when
 * they use a long hold... you will need to keep holding... once user
 * release the finger... it will transition back to the mini player."
 * Not a tap-to-open-then-separate-drag like the first cut — press,
 * hold past LONG_PRESS_MS to open, keep holding and drag to rotate,
 * lift to commit and close, all in one gesture.
 *
 * Works because `setPointerCapture` on the trigger element keeps
 * routing this pointer's move/up events to IT specifically, even once
 * the picker overlay mounts and visually covers the trigger — capture
 * follows the element that requested it, not whatever's on top.
 */
export function useRotaryDial(listLength: number, startIndex: number, onCommit: (index: number) => void) {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(startIndex);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const startIndexRef = useRef(startIndex);
  const movedRef = useRef(false);
  const activeRef = useRef(false);
  const indexRef = useRef(startIndex);

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // A capture failure shouldn't take the whole gesture down — see
      // the same call in PlayerWaveformScrubber.tsx.
    }
    startRef.current = { x: e.clientX, y: e.clientY };
    startIndexRef.current = startIndex;
    movedRef.current = false;
    clearTimer();
    timerRef.current = setTimeout(() => {
      if (movedRef.current) return;
      activeRef.current = true;
      indexRef.current = startIndexRef.current;
      setActive(true);
      setIndex(startIndexRef.current);
    }, LONG_PRESS_MS);
  }

  function onPointerMove(e: React.PointerEvent) {
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (!activeRef.current) {
      if (Math.abs(dx) > JITTER_PX || Math.abs(dy) > JITTER_PX) {
        movedRef.current = true;
        clearTimer();
      }
      return;
    }
    if (listLength === 0) return;
    const steps = Math.round(-dy / ROW_HEIGHT);
    const next = Math.min(listLength - 1, Math.max(0, startIndexRef.current + steps));
    indexRef.current = next;
    setIndex(next);
  }

  function onPointerUp() {
    clearTimer();
    if (activeRef.current) onCommit(indexRef.current);
    activeRef.current = false;
    setActive(false);
  }

  return {
    active,
    index,
    // No onPointerLeave: with capture held, browsers can still fire it
    // as the cursor physically leaves the (small) trigger's bounds —
    // committing early mid-drag would be wrong. onPointerUp/Cancel are
    // the only real end-of-gesture signals here.
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
