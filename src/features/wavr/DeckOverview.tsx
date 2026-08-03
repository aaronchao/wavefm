"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { WavrCard } from "@/src/core/wavr";
import { haptic } from "@/src/ui";
import { springs } from "@/src/ui/tokens";
import { CardFace } from "./CardFace";

/** Render at most ±4 covers around the centre — depth, not a wall of art. */
const MAX_FAN = 4;
/** Cover edge in px (must match the w-/h- classes below); half is the self-centre offset. */
const COVER = 200;

/**
 * The zoomed-out browser (§6.7) — an iTunes Cover Flow: a 3D perspective
 * carousel where the centred album cover faces you and its neighbours angle
 * away in depth. Reachable by long-press (drag to flip through, release to
 * pick) OR the `?` button / `O` key (arrows or a tap on any cover). The spring
 * on each cover's rotateY IS the flip animation as the selection moves.
 * Reduced motion swaps the flow for a plain, tap-to-select 2-column grid.
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
    // Keys the overview owns must not also reach the deck's handler underneath
    // (arrows would otherwise decide the card behind the flow).
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === "Enter") {
      e.stopPropagation();
      onJump(scrubIndex);
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
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
  const selected = queue[scrubIndex];
  const half = COVER / 2;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="listbox"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className="absolute inset-0 z-20 flex flex-col items-center justify-center overflow-hidden rounded-card bg-background/95 outline-none backdrop-blur"
    >
      {/* The 3D stage — perspective makes the angled side covers recede. */}
      <div className="relative w-full flex-1" style={{ perspective: 1000 }}>
        {visible.map(({ c, i, d }) => {
          // Covers to the left/right of centre slide out and rotate to face
          // inward; further ones recede in depth and fade.
          const offset = d === 0 ? 0 : Math.sign(d) * (72 + (Math.abs(d) - 1) * 46);
          return (
            <motion.button
              key={c.id}
              type="button"
              role="option"
              aria-selected={i === scrubIndex}
              aria-label={`${c.title}, from ${c.showTitle}`}
              onClick={() => onJump(i)}
              // top-left is pinned to the stage centre; the animated x/y carry
              // the −half self-centre offset so d=0 lands dead centre.
              className="absolute left-1/2 top-1/2 h-[200px] w-[200px] overflow-hidden rounded-2xl border border-black/10 shadow-[0_16px_40px_rgba(0,0,0,0.4)] dark:border-white/10"
              style={{ zIndex: 10 - Math.abs(d), transformStyle: "preserve-3d" }}
              animate={{
                x: offset - half,
                y: -half,
                rotateY: d === 0 ? 0 : d > 0 ? -52 : 52,
                z: -Math.abs(d) * 64,
                scale: d === 0 ? 1 : 0.82,
                opacity: Math.abs(d) > 3 ? 0 : 1 - Math.min(Math.abs(d), 4) * 0.16,
              }}
              transition={springs.rise}
            >
              <CardFace card={c} progress={0} playState="paused" variant="compact" />
              {/* A darkening sheen on the angled covers sells the 3D turn. */}
              {d !== 0 && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      d > 0
                        ? "linear-gradient(90deg, rgba(0,0,0,0.45), rgba(0,0,0,0))"
                        : "linear-gradient(270deg, rgba(0,0,0,0.45), rgba(0,0,0,0))",
                  }}
                />
              )}
              {i === scrubIndex && (
                <span className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-accent" />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* The centred cover's details, below the flow. */}
      {selected && (
        <div className="mb-3 w-full max-w-xs shrink-0 px-4 text-center">
          <p className="truncate text-sm font-semibold">{selected.title}</p>
          <p className="truncate text-xs text-zinc-500">{selected.showTitle}</p>
          <p className="mt-1 font-brand text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {scrubIndex + 1} of {queue.length} · release to play
          </p>
        </div>
      )}
    </div>
  );
}
