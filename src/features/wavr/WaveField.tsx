"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { DeckAudio } from "./useDeckAudio";
import { useWaveAnalyser } from "./useWaveAnalyser";

/**
 * The audio-reactive background (§6.6). Ambient layer, not a widget: no
 * axes, no peak meter, no chrome. Accent red only, never under card text
 * (the card stays opaque). rAF suspends when hidden, backgrounded, or
 * settled-idle, so a paused deck costs ~0% CPU.
 */
export function WaveField({
  audio,
  cardId,
  overview = false,
  enabled = true,
}: {
  audio: DeckAudio;
  cardId: string | undefined;
  /** The overview (§6.7) scales the field up and lifts its alpha. */
  overview?: boolean;
  enabled?: boolean;
}) {
  const reduce = useReducedMotion();
  const bloomRef = useRef<HTMLCanvasElement>(null);
  const bandRef = useRef<HTMLCanvasElement>(null);
  const analyser = useWaveAnalyser(audio, cardId);
  // Downgrade to the static resting band on low-core devices — a live
  // rAF-driven canvas isn't worth the battery on a 2-4 core phone.
  const lowPower =
    typeof navigator !== "undefined" && (navigator.hardwareConcurrency ?? 8) <= 4;

  useEffect(() => {
    if (!enabled || reduce || lowPower) return;
    const bloom = bloomRef.current;
    const band = bandRef.current;
    const rawBloomCtx = bloom?.getContext("2d");
    const rawBandCtx = band?.getContext("2d");
    if (!bloom || !band || !rawBloomCtx || !rawBandCtx) return;
    // Reassigned to freshly-typed consts: TS won't carry the null-narrowing
    // of the optional-chained values into the nested `step` closure below.
    const bloomCtx: CanvasRenderingContext2D = rawBloomCtx;
    const bandCtx: CanvasRenderingContext2D = rawBandCtx;
    const bloomEl: HTMLCanvasElement = bloom;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = band.clientWidth || 320;
    const cssH = band.clientHeight || 72;
    band.width = cssW * dpr;
    band.height = cssH * dpr;
    bandCtx.scale(dpr, dpr);

    let raf = 0;
    let stopped = false;
    let energy = 0;

    function step() {
      if (stopped) return;
      const target = audio.playState === "playing" ? 1 : 0.08;
      energy += (target - energy) * 0.08;
      const settledIdle = target < 0.5 && Math.abs(energy - target) < 0.004;
      const hidden = document.hidden;

      if (!hidden) {
        const bins = analyser.getFrame();
        const scaled = new Float32Array(bins.length);
        for (let i = 0; i < bins.length; i++) scaled[i] = bins[i] * energy;
        renderBand(bandCtx, cssW, cssH, scaled, overview);
        renderBloom(bloomCtx, bloomEl.width, bloomEl.height, scaled, overview);
      }

      // Stop scheduling once truly idle or backgrounded — a `visibilitychange`
      // listener below wakes it back up; playState changes re-run this effect.
      if (hidden || settledIdle) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(step);
    }

    function onVisible() {
      if (!document.hidden && raf === 0 && !stopped) raf = requestAnimationFrame(step);
    }
    document.addEventListener("visibilitychange", onVisible);
    raf = requestAnimationFrame(step);

    return () => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, reduce, lowPower, overview, analyser, audio.playState]);

  if (!enabled) return null;

  if (reduce || lowPower) {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[72px] overflow-hidden"
      >
        <div className="absolute inset-x-6 bottom-3 h-1 rounded-full bg-accent/10" />
      </div>
    );
  }

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <canvas
        ref={bloomRef}
        width={160}
        height={90}
        className="absolute inset-0 h-full w-full opacity-60 blur-[28px]"
      />
      {/* Anchored to the top half (was a 72px sliver pinned to the bottom) —
          now the card above it is Liquid Glass (translucent + backdrop-blur),
          so this reads through instead of being fully hidden underneath it. */}
      <canvas ref={bandRef} className="absolute inset-x-0 top-0 h-1/2 w-full" />
    </div>
  );
}

function renderBand(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bins: Float32Array,
  overview: boolean,
): void {
  ctx.clearRect(0, 0, w, h);
  const alpha = overview ? 0.5 : 0.36;
  ctx.fillStyle = `rgba(255,59,48,${alpha})`;
  const n = bins.length;
  const barW = w / (n * 2);
  const mid = w / 2;
  for (let i = 0; i < n; i++) {
    const amp = Math.max(0, Math.min(1, bins[i]));
    const barH = Math.max(2, amp * h);
    ctx.fillRect(mid + i * barW, h - barH, barW * 0.8, barH);
    ctx.fillRect(mid - (i + 1) * barW, h - barH, barW * 0.8, barH);
  }
}

function renderBloom(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bins: Float32Array,
  overview: boolean,
): void {
  ctx.clearRect(0, 0, w, h);
  let sum = 0;
  for (const b of bins) sum += b;
  const energy = bins.length > 0 ? sum / bins.length : 0;
  const alpha = (overview ? 0.55 : 0.4) * (0.3 + energy * 0.7);
  const r = Math.max(w, h) * 0.8;
  // Biased toward the top — the card leaves a real gap there now (not
  // inset-0) specifically so this glow has somewhere unobstructed to land.
  const grad = ctx.createRadialGradient(w / 2, h * 0.18, 0, w / 2, h * 0.18, r);
  grad.addColorStop(0, `rgba(255,59,48,${alpha})`);
  grad.addColorStop(1, "rgba(255,59,48,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}
