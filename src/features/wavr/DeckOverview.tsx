"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { WavrCard } from "@/src/core/wavr";
import { haptic } from "@/src/ui";
import { CardFace } from "./CardFace";

/** Render at most ±5 cards around the centre (11 total) — depth, not a wall of text. */
const MAX_FAN = 5;

/**
 * The zoomed-out fan + scrub rail (§6.7). Reachable by long-press OR the
 * `⌸` button / `O` key — both land here, so the gesture is an enhancement,
 * never the only way in. Reduced motion swaps the fan for a plain,
 * tap-to-select 2-column grid.
 */
export function DeckOverview({
  queue,
  scrubIndex,
  onScrub,
  onJump,
  onClose,
}: {
  queue: WavrCard[];
  scrubIndex: number;
  onScrub: (to: number) => void;
  onJump: (to: number) => void;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "Enter") {
      onJump(scrubIndex);
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Tab") {
      e.preventDefault();
      const dir = e.key === "ArrowLeft" ? -1 : 1;
      const next = Math.min(queue.length - 1, Math.max(0, scrubIndex + dir));
      if (next !== scrubIndex) {
        haptic("detent");
        onScrub(next);
      }
    }
  }

  const label = `Overview. ${queue.length} cards. Card ${scrubIndex + 1} selected.`;

  if (reduce) {
    return (
      <div
        ref={containerRef}
        tabIndex={0}
        role="listbox"
        aria-label={label}
        onKeyDown={handleKeyDown}
        className="absolute inset-0 z-20 grid grid-cols-2 gap-2 overflow-y-auto rounded-card bg-background p-3 outline-none"
      >
        {queue.map((c, i) => (
          <button
            key={c.id}
            type="button"
            role="option"
            aria-selected={i === scrubIndex}
            aria-label={`${c.title}, from ${c.showTitle}`}
            onClick={() => onJump(i)}
            className={`overflow-hidden rounded-tile border text-left ${
              i === scrubIndex ? "border-accent ring-2 ring-accent" : "border-surface-border"
            }`}
          >
            <CardFace card={c} progress={0} playState="paused" variant="compact" />
          </button>
        ))}
      </div>
    );
  }

  const visible = queue
    .map((c, i) => ({ c, i, d: i - scrubIndex }))
    .filter((x) => Math.abs(x.d) <= MAX_FAN);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="listbox"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className="absolute inset-0 z-20 flex items-center justify-center overflow-hidden rounded-card bg-background/95 backdrop-blur outline-none"
    >
      {visible.map(({ c, i, d }) => (
        <motion.button
          key={c.id}
          type="button"
          role="option"
          aria-selected={i === scrubIndex}
          aria-label={`${c.title}, from ${c.showTitle}`}
          onClick={() => onJump(i)}
          animate={{
            x: d * 132,
            y: Math.abs(d) * 8,
            rotate: d * 3,
            scale: 1 - Math.min(Math.abs(d), 4) * 0.06,
            opacity: 1 - Math.min(Math.abs(d), 5) * 0.14,
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.9 }}
          className={`absolute h-40 w-28 overflow-hidden rounded-tile border-2 ${
            i === scrubIndex ? "border-accent" : "border-surface-border"
          }`}
          style={{ zIndex: MAX_FAN - Math.abs(d) }}
        >
          <CardFace card={c} progress={0} playState="paused" variant="compact" />
        </motion.button>
      ))}
      <p className="absolute bottom-2 font-brand text-[11px] uppercase tracking-[0.18em] text-zinc-400">
        Card {scrubIndex + 1} of {queue.length}
      </p>
    </div>
  );
}
