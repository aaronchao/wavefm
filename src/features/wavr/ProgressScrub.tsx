"use client";

import { useRef } from "react";

/**
 * The clip's progress bar, draggable to any timestamp. Its own pointer
 * handlers stop propagation so a drag here never reaches the deck's card
 * gesture system underneath (tap-to-pause / swipe-to-decide / long-press) —
 * two competing gesture recognizers on the same pointer stream is exactly
 * the bug that broke long-press-to-overview once already (see useCardGesture).
 *
 * The hit area is taller than the visible track (a 4px bar is unreachable
 * by a fingertip) — a wrapping div carries the touch target and the pointer
 * handlers; the thin bar inside is purely visual.
 */
export function ProgressScrub({
  progress,
  onSeek,
}: {
  /** 0..1 through the clip. */
  progress: number;
  /** Omit to render a plain, non-interactive bar (e.g. a locked/unavailable card). */
  onSeek?: (fraction: number) => void;
}) {
  const hitAreaRef = useRef<HTMLDivElement>(null);

  function fractionAt(clientX: number): number {
    const rect = hitAreaRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return progress;
    return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!onSeek) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    onSeek(fractionAt(e.clientX));
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!onSeek || e.buttons === 0) return;
    e.stopPropagation();
    onSeek(fractionAt(e.clientX));
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!onSeek) return;
    e.stopPropagation();
  }

  return (
    <div
      ref={hitAreaRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role={onSeek ? "slider" : undefined}
      aria-label={onSeek ? "Seek within the clip" : undefined}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
      aria-valuenow={onSeek ? Math.round(progress * 100) : undefined}
      className="flex h-6 flex-1 items-center"
      style={onSeek ? { touchAction: "none" } : undefined}
    >
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/30">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </div>
  );
}
