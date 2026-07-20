"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

/**
 * The interactive metaphor: tap shows you'd save, each fills a glass of
 * "taste". Fill the fifth and it overflows — the burst becomes your
 * personalized feed. It's a hands-on demo of the promise (you save, we do
 * the research, your feed pours out). Under prefers-reduced-motion it fills
 * and reveals instantly, no spill or shatter.
 */
const SAMPLES = ["Radiolab", "故事FM", "Reply All", "忽左忽右", "99% Invisible", "The Daily"];
const RECS = ["Heavyweight", "不合时宜", "Criminal", "声东击西", "Song Exploder"];
const GLASSES = [0, 1, 2, 3, 4];

// decorative shatter particles — fixed once so nothing impure runs in render
const PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  x: (Math.random() - 0.5) * 260,
  y: -40 - Math.random() * 130,
  r: Math.random() * 180 - 90,
  d: 0.5 + Math.random() * 0.4,
}));

export function TasteGlasses() {
  const reduce = useReducedMotion();
  const [filled, setFilled] = useState(0);
  const overflowing = filled >= GLASSES.length;
  const particles = PARTICLES;

  const tap = () => setFilled((n) => Math.min(GLASSES.length, n + 1));
  const reset = () => setFilled(0);

  return (
    <div className="rounded-card border border-surface-border bg-surface/40 p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-400">
            Try it
          </span>
          <h3 className="mt-1 text-xl font-bold sm:text-2xl">
            Save a few. Watch your taste overflow.
          </h3>
        </div>
        <button
          type="button"
          onClick={reset}
          className="rounded-pill border border-surface-border bg-background px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-zinc-500 transition-colors hover:text-foreground"
        >
          Reset
        </button>
      </div>

      {/* glasses */}
      <div className="relative flex items-end justify-center gap-3 sm:gap-5">
        {GLASSES.map((g) => {
          const isFull = filled > g;
          const isLast = g === GLASSES.length - 1;
          return (
            <div key={g} className="relative flex flex-col items-center">
              <div className="relative h-24 w-14 overflow-visible sm:h-28 sm:w-16">
                {/* glass body */}
                <div className="absolute inset-0 overflow-hidden rounded-b-xl rounded-t-md border-x border-b border-surface-border bg-background/60">
                  <motion.div
                    className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-accent to-accent/70"
                    initial={false}
                    animate={{ height: isFull ? "82%" : "0%" }}
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 18 }}
                  />
                </div>
                {/* overflow spill + shatter from the last glass */}
                {isLast && overflowing && !reduce && (
                  <>
                    <motion.div
                      className="absolute inset-x-0 bottom-0 rounded-b-xl bg-accent"
                      initial={{ height: "82%" }}
                      animate={{ height: ["82%", "118%", "82%"] }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                    />
                    {particles.map((p) => (
                      <motion.span
                        key={p.id}
                        className="absolute left-1/2 top-0 h-1.5 w-1.5 rounded-full bg-accent"
                        initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                        animate={{ x: p.x, y: p.y, opacity: 0, rotate: p.r }}
                        transition={{ duration: p.d, ease: "easeOut" }}
                      />
                    ))}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* sample shows to "save" */}
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        {SAMPLES.slice(0, 5).map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={tap}
            disabled={filled > i}
            className={`rounded-pill border px-3 py-1.5 text-sm font-medium transition-all ${
              filled > i
                ? "border-accent bg-accent-soft text-accent"
                : "border-surface-border bg-background hover:-translate-y-0.5 hover:border-accent"
            }`}
          >
            {filled > i ? "✓ " : "+ "}
            {s}
          </button>
        ))}
      </div>

      {/* the feed pours out */}
      <div className="mt-7 min-h-[3rem]">
        <AnimatePresence>
          {overflowing && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? { duration: 0 } : { delay: 0.35, type: "spring", stiffness: 200, damping: 24 }}
            >
              <p className="mb-3 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
                Your feed, poured out
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {RECS.map((r, i) => (
                  <motion.span
                    key={r}
                    className="rounded-pill border border-surface-border bg-background px-3 py-1.5 text-sm font-semibold shadow-sm"
                    initial={{ opacity: 0, scale: 0.7, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={reduce ? { duration: 0 } : { delay: 0.4 + i * 0.08, type: "spring", stiffness: 300, damping: 20 }}
                  >
                    {r}
                  </motion.span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
