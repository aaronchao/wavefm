"use client";

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useEffect, useRef } from "react";
import { commitDistance, decideSwipe, SWIPE, type WavrCard } from "@/src/core/wavr";
import { haptic, springs } from "@/src/ui";
import { CardFace } from "./CardFace";
import type { DeckAudio } from "./useDeckAudio";

/**
 * The only component that touches drag (§3.1, §6.2).
 *
 * Decisions are dispatched up (`onDecide`) but the exit animation is driven
 * by the `flying` PROP, not by the local drag handler — that way a
 * DeckControls click or a keyboard shortcut gets the identical exit as a
 * drag commit, since all three paths go through the same reducer action.
 */
export function SwipeCard({
  card,
  flying,
  onDecide,
  onFlownOut,
  onDragX,
  audio,
}: {
  card: WavrCard;
  flying: { id: string; dir: -1 | 1 } | null;
  onDecide: (decision: "save" | "skip", dir: -1 | 1) => void;
  onFlownOut: () => void;
  onDragX?: (x: MotionValue<number>) => void;
  audio: DeckAudio;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
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
    return ref.current?.offsetWidth ?? 360;
  }

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

  function handleDrag(_: unknown, info: { offset: { x: number } }) {
    const dist = commitDistance(width());
    const dir: -1 | 0 | 1 = info.offset.x > dist ? 1 : info.offset.x < -dist ? -1 : 0;
    if (dir !== crossed.current) {
      if (dir !== 0) haptic("tick");
      crossed.current = dir;
    }
  }

  function handleDragEnd(
    _: unknown,
    info: { offset: { x: number }; velocity: { x: number } },
  ) {
    crossed.current = 0;
    const outcome = decideSwipe({ dx: info.offset.x, vx: info.velocity.x, width: width() });
    if (outcome === "return") return; // framer springs back via the bounce transition below
    onDecide(outcome, outcome === "save" ? 1 : -1);
  }

  return (
    <motion.div
      ref={ref}
      className="absolute inset-0"
      style={
        reduce
          ? { opacity: staticOpacity }
          : { x, rotate, scale: lift, originY: 1.15, opacity: exitOpacity }
      }
      drag={reduce ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      dragMomentum={false}
      dragTransition={{ bounceStiffness: springs.snap.stiffness, bounceDamping: springs.snap.damping }}
      whileTap={reduce ? undefined : { cursor: "grabbing" }}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
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
            className="font-brand pointer-events-none absolute left-4 top-4 z-10 -rotate-12 rounded-pill border-2 border-zinc-400 px-3 py-1 text-sm font-bold uppercase text-zinc-400"
          >
            Skip
          </motion.span>
        </>
      )}
      <CardFace card={card} progress={audio.progress} playState={audio.playState} />
    </motion.div>
  );
}
