"use client";

import { useMemo, useRef, type RefObject } from "react";
import { scrubTarget } from "@/src/core/wavr/scrub";
import { haptic } from "@/src/ui";
import type { SwipeCardHandle } from "./SwipeCard";
import type { UseSwipeDeck } from "./useSwipeDeck";

/**
 * The deck's ONE pointer-event listener, resolving to exactly one of three
 * gestures — drag-to-decide, long-press-to-overview, or a plain tap:
 *
 *   - hold still (<10px) for 320ms -> open the overview, then horizontal
 *     travel scrubs the fan; lifting the finger jumps to whatever is under
 *     it (or closes the overview if you never moved off the start card).
 *   - move past 10px before the hold fires -> commits to a drag; the card
 *     tracks the finger and releasing decides save/skip/return.
 *   - neither (a quick tap with ~no movement) -> toggles play/pause.
 *
 * This used to be two independent gesture recognizers on the same pointer
 * events — framer-motion's `drag="x"` on SwipeCard, and a raw long-press
 * timer here. They raced: framer's own drag threshold is a few px, well
 * under the 10px long-press-cancel check, so real touch jitter started a
 * visible drag before the 320ms hold could ever land. Driving the card's
 * position imperatively (SwipeCardHandle) from this single state machine
 * removes the second listener entirely instead of trying to referee it.
 */
export function useCardGesture(
  deck: UseSwipeDeck,
  cardRef: RefObject<SwipeCardHandle | null>,
  onDecide: (decision: "save" | "skip", dir: -1 | 1) => void,
  onTap: () => void,
) {
  const start = useRef<{ x: number; y: number; t: number; index: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mode = useRef<"pending" | "drag" | "overview">("pending");
  const lastDetentAt = useRef(0);
  /** Last two samples, for a rough release velocity estimate. */
  const prevSample = useRef<{ x: number; t: number } | null>(null);
  const lastSample = useRef<{ x: number; t: number } | null>(null);

  return useMemo(
    () => ({
      onPointerDown(e: React.PointerEvent) {
        if (deck.state.mode === "overview" || deck.state.flying) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        start.current = { x: e.clientX, y: e.clientY, t: performance.now(), index: deck.state.index };
        mode.current = "pending";
        prevSample.current = null;
        lastSample.current = { x: e.clientX, t: performance.now() };
        timer.current = setTimeout(() => {
          if (mode.current !== "pending") return;
          mode.current = "overview";
          deck.openOverview();
        }, 320);
      },
      onPointerMove(e: React.PointerEvent) {
        if (!start.current) return;
        const dx = e.clientX - start.current.x;
        prevSample.current = lastSample.current;
        lastSample.current = { x: e.clientX, t: performance.now() };

        if (mode.current === "pending") {
          if (Math.abs(dx) <= 10) return; // still ambiguous — no visual movement yet
          clearTimeout(timer.current);
          mode.current = "drag";
        }

        if (mode.current === "drag") {
          cardRef.current?.applyDrag(dx);
          return;
        }

        // overview: scrub the fan under the finger
        const target = scrubTarget({
          dx,
          startIndex: start.current.index,
          count: deck.state.queue.length,
        });
        if (target !== deck.state.scrubIndex) {
          const now = Date.now();
          if (now - lastDetentAt.current > 40) {
            haptic("detent");
            lastDetentAt.current = now;
          }
          deck.scrub(target);
        }
      },
      onPointerUp() {
        clearTimeout(timer.current);
        if (!start.current) return;

        if (mode.current === "pending") {
          onTap();
        } else if (mode.current === "drag") {
          const a = prevSample.current;
          const b = lastSample.current;
          const dt = a && b ? (b.t - a.t) / 1000 : 0;
          const vx = a && b && dt > 0 ? (b.x - a.x) / dt : 0;
          const outcome = cardRef.current?.releaseDrag(vx) ?? "return";
          if (outcome !== "return") onDecide(outcome, outcome === "save" ? 1 : -1);
        } else {
          const target = deck.state.scrubIndex ?? start.current.index;
          if (target !== start.current.index) deck.jump(target);
          else deck.closeOverview();
        }

        start.current = null;
        mode.current = "pending";
      },
    }),
    [deck, cardRef, onDecide, onTap],
  );
}
