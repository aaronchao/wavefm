"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * The "how we decide" centerpiece: real human-signal sources stream in from
 * the edges and resolve into one ranked pick. It loops on its own and stands
 * still (fully assembled) under prefers-reduced-motion. Pure decoration —
 * no data, no network — so it's cheap and never blocks.
 */
const SOURCES = [
  { label: "Reddit", sub: "412 threads", x: "-120%", y: "-70%" },
  { label: "豆瓣", sub: "9.1 ★", x: "120%", y: "-55%" },
  { label: "小宇宙", sub: "2.3k comments", x: "-130%", y: "60%" },
  { label: "Apple 榜", sub: "#4", x: "125%", y: "70%" },
  { label: "Listen Score", sub: "82", x: "0%", y: "-115%" },
];

export function SignalsConverge() {
  const reduce = useReducedMotion();

  return (
    <div className="relative mx-auto flex h-[320px] w-full max-w-md items-center justify-center">
      {/* orbiting source chips converging on the card */}
      {SOURCES.map((s, i) => (
        <motion.div
          key={s.label}
          className="absolute left-1/2 top-1/2 z-0"
          style={{ x: s.x, y: s.y }}
          initial={false}
          animate={
            reduce
              ? { opacity: 0.55, scale: 0.92 }
              : {
                  x: [s.x, "0%"],
                  y: [s.y, "0%"],
                  opacity: [0, 1, 1, 0],
                  scale: [0.8, 1, 1, 0.6],
                }
          }
          transition={
            reduce
              ? undefined
              : {
                  duration: 2.8,
                  repeat: Infinity,
                  delay: i * 0.42,
                  ease: "easeInOut",
                  times: [0, 0.35, 0.7, 1],
                }
          }
        >
          <span className="-translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-pill border border-surface-border bg-background/90 px-2.5 py-1 font-mono text-[11px] shadow-sm backdrop-blur">
            <span className="font-semibold text-accent">{s.label}</span>
            <span className="ml-1.5 text-zinc-400">{s.sub}</span>
          </span>
        </motion.div>
      ))}

      {/* the resolved pick */}
      <motion.div
        className="relative z-10 w-64 rounded-card border border-surface-border bg-background p-4 shadow-lg"
        initial={false}
        animate={reduce ? { scale: 1 } : { scale: [1, 1.03, 1] }}
        transition={reduce ? undefined : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-400">
            Rank 01
          </span>
          <span className="rounded-pill bg-accent px-2 py-0.5 font-mono text-[11px] font-semibold text-white">
            SIG 0.94
          </span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 rounded-tile bg-gradient-to-br from-accent/30 to-surface" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">Your next favourite</p>
            <p className="truncate text-xs text-accent">▶ Loved on Reddit · 9.1 on 豆瓣</p>
          </div>
        </div>
        <div className="mt-3 flex items-end gap-1">
          {[0.5, 0.8, 0.65, 1, 0.75, 0.9].map((h, i) => (
            <motion.span
              key={i}
              className="w-full rounded-sm bg-accent/70"
              style={{ height: 26 * h }}
              animate={reduce ? undefined : { scaleY: [h, 0.4, h] }}
              transition={
                reduce
                  ? undefined
                  : { duration: 1 + i * 0.15, repeat: Infinity, ease: "easeInOut" }
              }
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
