"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { PlayState } from "./useDeckAudio";

/** Reads a changing value inside a long-lived rAF loop without re-subscribing
 *  the effect (or writing a ref during render). */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

/**
 * The audio-reactive waveform band. Rendered as its OWN visible strip above
 * the card (it used to be a -z-10 background the opaque cover art sat on top
 * of, so it was invisible on mobile and half-hidden on desktop).
 *
 * Honest sync (§ user request "if the audio is silent, the waveform should be
 * a line"): true FFT needs CORS, which almost no podcast CDN grants, so the
 * bars are a synthesized envelope GATED on real playback state — they pulse
 * only while audio is actually playing and collapse to a flat centre line the
 * instant it pauses, finishes, stalls, or hasn't started. `progress` drives
 * the animation phase so a scrub/seek is reflected too. rAF suspends when the
 * tab is hidden or the field has settled flat, so an idle deck costs ~0% CPU.
 */
export function WaveField({
  playState,
  progress,
  enabled = true,
}: {
  playState: PlayState;
  progress: number;
  enabled?: boolean;
}) {
  const reduce = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playing = playState === "playing";
  // Read progress inside the rAF loop without re-subscribing the effect.
  const progressRef = useLatest(progress);

  useEffect(() => {
    if (!enabled || reduce) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let cssW = 0;
    let cssH = 0;
    const resize = () => {
      cssW = canvas.clientWidth || 320;
      cssH = canvas.clientHeight || 64;
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    let raf = 0;
    let stopped = false;
    let energy = 0;

    const step = () => {
      if (stopped) return;
      const target = playing ? 1 : 0;
      energy += (target - energy) * 0.1;
      const flat = target === 0 && energy < 0.01;

      if (!document.hidden) {
        renderWave(ctx, cssW, cssH, energy, progressRef.current);
      }
      // Draw one last flat frame, then stop scheduling until state changes or
      // the tab returns — a settled line and a hidden tab both cost nothing.
      if (document.hidden || flat) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(step);
    };

    const onVisible = () => {
      if (!document.hidden && raf === 0 && !stopped) raf = requestAnimationFrame(step);
    };
    document.addEventListener("visibilitychange", onVisible);
    raf = requestAnimationFrame(step);

    return () => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, reduce, playing, progressRef]);

  if (!enabled) return null;

  // Reduced motion: a plain static line, no animation.
  if (reduce) {
    return (
      <div aria-hidden="true" className="flex h-16 items-center">
        <div className="h-0.5 w-full rounded-full bg-accent/40" />
      </div>
    );
  }

  return (
    <div aria-hidden="true" className="h-16 w-full">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}

/** Number of bars across the band. */
const BARS = 56;

/**
 * A centre-anchored bar waveform. `energy` (0..1) is the eased play envelope;
 * at 0 every bar is a 2px stub so the whole thing reads as a flat line, at 1
 * the bars pulse. `phase` (from clip progress) walks the pattern so it visibly
 * moves with playback and jumps on a seek.
 */
function renderWave(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  energy: number,
  phase: number,
): void {
  ctx.clearRect(0, 0, w, h);
  const mid = h / 2;
  const gap = w / BARS;
  const barW = gap * 0.55;
  const t = phase * 40 + performance.now() / 600;
  const alpha = 0.25 + energy * 0.55;
  ctx.fillStyle = `rgba(255,59,48,${alpha})`;

  for (let i = 0; i < BARS; i++) {
    // Two offset sines give an irregular, non-repeating envelope; a bell taper
    // keeps the ends shorter than the middle so it looks like a clip, not a
    // fence. Multiplied by energy so silence flattens everything at once.
    const wobble = 0.5 + 0.5 * Math.sin(i * 0.5 + t) * Math.sin(i * 0.17 - t * 0.6);
    const taper = Math.sin((i / (BARS - 1)) * Math.PI);
    const amp = energy * wobble * taper;
    const barH = Math.max(2, amp * (h - 6));
    const x = i * gap + (gap - barW) / 2;
    ctx.beginPath();
    // rounded caps read as "liquid" rather than blocky
    roundRect(ctx, x, mid - barH / 2, barW, barH, Math.min(barW / 2, 2));
    ctx.fill();
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
