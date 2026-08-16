"use client";

import { useRef, useState } from "react";
import { scrubDeltaSec } from "@/src/core/player/playerMath";

const OPEN_HOLD_MS = 400;
const FINE_HOLD_MS = 400;
const JITTER_PX = 10;

/**
 * The sole gesture owner for the mini player's waveform — replaces the
 * drag-handling that used to live inside PlayerWaveformScrubber itself
 * (that component is now purely presentational; see its own comment).
 * Rolled in here because a quick drag and a long hold need to share one
 * continuous pointer session: dragging (any distance, no wait) scrubs
 * immediately like a normal seek bar, exactly as before, while holding
 * STILL for OPEN_HOLD_MS with no movement escalates the same session into
 * the fullscreen arc dial (FullscreenSeekDial.tsx) — Aaron's ask
 * (2026-08-16) for the seek dial to be "a separate trigger" from the
 * episode/show rotary dial (useRotaryDial.ts), reachable from the
 * waveform itself rather than nested inside the rotary page where
 * holding one gesture blocked the other.
 *
 * Holding still a second FINE_HOLD_MS once the dial is open engages
 * precision mode, the same "hold still to zoom" idea the old in-place
 * scrubber used, just now happening inside the fullscreen dial instead
 * of on the small mini waveform.
 */
export function useHoldSeek(currentTime: number, duration: number, onCommit: (sec: number) => void) {
  const [dragging, setDragging] = useState(false);
  const [active, setActive] = useState(false);
  const [previewSec, setPreviewSec] = useState(currentTime);
  const [fine, setFine] = useState(false);

  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const startSecRef = useRef(currentTime);
  const draggingRef = useRef(false);
  const activeRef = useRef(false);
  const fineRef = useRef(false);
  const previewRef = useRef(currentTime);

  function clearOpenTimer() {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }

  function clearFineTimer() {
    if (fineTimerRef.current) {
      clearTimeout(fineTimerRef.current);
      fineTimerRef.current = null;
    }
  }

  function armFineTimer() {
    clearFineTimer();
    fineTimerRef.current = setTimeout(() => {
      if (activeRef.current && !fineRef.current) {
        fineRef.current = true;
        setFine(true);
      }
    }, FINE_HOLD_MS);
  }

  function onPointerDown(e: React.PointerEvent) {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // a capture failure shouldn't abort the gesture — see PlayerWaveformScrubber.tsx
    }
    startRef.current = { x: e.clientX, y: e.clientY };
    startSecRef.current = currentTime;
    previewRef.current = currentTime;
    activeRef.current = false;
    fineRef.current = false;
    draggingRef.current = true;
    setDragging(true);
    setActive(false);
    setFine(false);
    setPreviewSec(currentTime);

    clearOpenTimer();
    openTimerRef.current = setTimeout(() => {
      activeRef.current = true;
      setActive(true);
      armFineTimer();
    }, OPEN_HOLD_MS);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (!activeRef.current) {
      // Real movement before the hold-still window elapses means this is
      // a normal quick scrub, not an attempt to open the dial — cancel
      // the open timer outright so a later pause mid-drag can't still
      // trigger it.
      if (Math.abs(dx) > JITTER_PX || Math.abs(dy) > JITTER_PX) clearOpenTimer();
    } else {
      armFineTimer();
    }
    const width = typeof window !== "undefined" ? window.innerWidth : 320;
    const deltaSec = scrubDeltaSec(dx, width, duration, fineRef.current);
    const next = Math.min(Math.max(startSecRef.current + deltaSec, 0), duration > 0 ? duration : Infinity);
    previewRef.current = next;
    setPreviewSec(next);
  }

  function onPointerUp() {
    clearOpenTimer();
    clearFineTimer();
    if (draggingRef.current) onCommit(previewRef.current);
    draggingRef.current = false;
    activeRef.current = false;
    fineRef.current = false;
    setDragging(false);
    setActive(false);
    setFine(false);
  }

  return {
    dragging,
    active,
    previewSec,
    fine,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
