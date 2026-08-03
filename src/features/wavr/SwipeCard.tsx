"use client";

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { commitDistance, decideSwipe, SWIPE, type WavrCard } from "@/src/core/wavr";
import { haptic, springs } from "@/src/ui";
import { CardFace } from "./CardFace";
import type { PlayState } from "./useDeckAudio";

/** Imperative surface the parent's unified gesture handler drives directly —
 *  there is no framer `drag` on this component (see useCardGesture for why:
 *  a competing gesture recognizer on the same pointer events is what broke
 *  long-press-to-overview). */
export type SwipeCardHandle = {
  /** Apply a live horizontal offset during a committed drag. */
  applyDrag(dx: number): void;
  /** Decide the release: commits save/skip, or springs back to center. */
  releaseDrag(vx: number): "save" | "skip" | "return";
  width(): number;
};

/**
 * The only component that renders the card's live drag transforms (§3.1, §6.2).
 *
 * Decisions are dispatched up (`onDecide`) but the exit animation is driven
 * by the `flying` PROP, not by the local drag handler — that way a
 * DeckControls click or a keyboard shortcut gets the identical exit as a
 * drag commit, since all three paths go through the same reducer action.
 */
export const SwipeCard = forwardRef<
  SwipeCardHandle,
  {
    card: WavrCard;
    flying: { id: string; dir: -1 | 1 } | null;
    onFlownOut: () => void;
    onDragX?: (x: MotionValue<number>) => void;
    /** 0..1 through the clip, for the card's progress bar. */
    progress: number;
    playState: PlayState;
    /** Drag-to-seek within the clip. */
    onSeek: (fraction: number) => void;
  }
>(function SwipeCard({ card, flying, onFlownOut, onDragX, progress, playState, onSeek }, ref) {
  const reduce = useReducedMotion();
  const elRef = useRef<HTMLDivElement>(null);
  /** Once-per-direction tick; resets on release and on re-entering the dead zone. */
  const crossed = useRef<-1 | 0 | 1>(0);

  const x = useMotionValue(0);
  const staticOpacity = useMotionValue(1);
  const rotate = useTransform(x, [-240, 240], [-SWIPE.maxRotate, SWIPE.maxRotate]);
  const saveOp = useTransform(x, [40, SWIPE.stampFull], [0, 1]);
  const skipOp = useTransform(x, [-SWIPE.stampFull, -40], [1, 0]);
  const lift = useTransform(x, [-240, 0, 240], [1.03, 1, 1.03]);
  // Opacity fades over roughly the last 40% of the fling; the fixed range
  // covers realistic viewport widths without needing a live measurement.
  const exitOpacity = useTransform(x, [-900, -520, 520, 900], [0, 1, 1, 0]);

  // Hand the motion value up so PeekCard can react to it (§3.1).
  useEffect(() => {
    onDragX?.(x);
  }, [onDragX, x]);

  function width(): number {
    return elRef.current?.offsetWidth ?? 360;
  }

  useImperativeHandle(
    ref,
    () => ({
      width,
      applyDrag(dx: number) {
        x.set(dx);
        const dist = commitDistance(width());
        const dir: -1 | 0 | 1 = dx > dist ? 1 : dx < -dist ? -1 : 0;
        if (dir !== crossed.current) {
          if (dir !== 0) haptic("tick");
          crossed.current = dir;
        }
      },
      releaseDrag(vx: number) {
        crossed.current = 0;
        const outcome = decideSwipe({ dx: x.get(), vx, width: width() });
        if (outcome === "return") {
          void animate(x, 0, springs.snap);
        }
        return outcome;
      },
    }),
    [x],
  );

  // The single exit trigger, regardless of whether `flying` was set by a
  // drag release, a DeckControls click, or a keyboard shortcut.
  useEffect(() => {
    if (!flying || flying.id !== card.id) return;
    if (reduce) {
      void animate(staticOpacity, 0, { duration: 0.12 }).then(() => onFlownOut());
      return;
    }
    void animate(x, flying.dir * width() * 1.4, {
      ...springs.fling,
      velocity: flying.dir * SWIPE.velocity,
    }).then(() => onFlownOut());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- x/staticOpacity/onFlownOut are stable per card instance
  }, [flying, card.id, reduce]);

  return (
    <motion.div
      ref={elRef}
      className="absolute inset-0"
      style={
        reduce
          ? { opacity: staticOpacity }
          : { x, rotate, scale: lift, originY: 1.15, opacity: exitOpacity, touchAction: "none" }
      }
    >
      {!reduce && (
        <>
          <motion.span
            style={{ opacity: saveOp }}
            className="font-brand pointer-events-none absolute right-4 top-4 z-10 rotate-12 rounded-pill border-2 border-accent px-3 py-1 text-sm font-bold uppercase text-accent"
          >
            Save
          </motion.span>
          <motion.span
            style={{ opacity: skipOp }}
            className="font-brand pointer-events-none absolute left-4 top-4 z-10 -rotate-12 rounded-pill border-2 border-zinc-400 px-3 py-1 text-sm font-bold uppercase text-muted-foreground"
          >
            Skip
          </motion.span>
        </>
      )}
      <CardFace card={card} progress={progress} playState={playState} onSeek={onSeek} />
    </motion.div>
  );
});
