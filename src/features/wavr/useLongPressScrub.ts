"use client";

import { useMemo, useRef } from "react";
import { scrubTarget } from "@/src/core/wavr/scrub";
import { haptic } from "@/src/ui";
import type { UseSwipeDeck } from "./useSwipeDeck";

/**
 * Long-press -> overview -> scrub (§6.7). Hold 320ms with movement < 10px to
 * enter the overview; movement past 10px first cancels the timer so drag
 * wins. Drag and long-press never both fire.
 */
export function useLongPressScrub(deck: UseSwipeDeck) {
  const start = useRef<{ x: number; index: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const entered = useRef(false);
  const lastDetentAt = useRef(0);

  return useMemo(
    () => ({
      onPointerDown(e: React.PointerEvent) {
        if (deck.state.mode === "overview" || deck.state.flying) return;
        start.current = { x: e.clientX, index: deck.state.index };
        entered.current = false;
        timer.current = setTimeout(() => {
          if (!start.current) return;
          entered.current = true;
          deck.openOverview();
        }, 320);
      },
      onPointerMove(e: React.PointerEvent) {
        if (!start.current) return;
        const dx = e.clientX - start.current.x;
        if (!entered.current) {
          if (Math.abs(dx) > 10) {
            clearTimeout(timer.current);
            start.current = null; // real movement before the hold fires -> drag wins
          }
          return;
        }
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
        if (entered.current) {
          const target = deck.state.scrubIndex ?? start.current?.index ?? deck.state.index;
          if (target !== start.current?.index) deck.jump(target);
          else deck.closeOverview();
        }
        start.current = null;
        entered.current = false;
      },
    }),
    [deck],
  );
}
