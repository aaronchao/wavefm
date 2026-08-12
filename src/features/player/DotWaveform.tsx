"use client";

import { useEffect, useRef } from "react";

/**
 * Nothing-brand dot-matrix waveform for the Play bar and the Wavr deck —
 * replaced the earlier Siri-style flowing line with vertical bars built out
 * of stacked dots, on a faint dot-grid backdrop, matching the dot-matrix
 * language already used for the globe (GlobeBackdrop) and section labels.
 *
 * On amplitude: true audio-reactive height (louder = taller) needs the Web
 * Audio API's AnalyserNode, which only returns real samples from a
 * *same-origin or CORS-enabled* media element. Podcast clips stream straight
 * from third-party CDNs (most send no CORS header), and routing that audio
 * through Web Audio would either fail the load (with crossOrigin set) or mute
 * it (without) — and the project deliberately does NOT proxy media (it would
 * burn the free hosting tier). So amplitude here is a synthetic envelope that
 * *reads* like speech — swelling and receding on a slow random walk — rather
 * than a literal reading of the clip. `progress` colours the travelled part.
 */
export function DotWaveform({
  active,
  progress,
  className = "",
}: {
  /** True while a clip is actually playing — drives the motion. */
  active: boolean;
  /** 0..1 through the clip — the coloured/dimmed split point. */
  progress: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Latest props read inside the rAF loop without restarting it. Synced in
  // effects (never during render) so the React 19 lint stays happy.
  const activeRef = useRef(active);
  const progressRef = useRef(progress);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let t = 0;
    // Same wandering-envelope approach as the line it replaced: eases toward
    // a randomly re-targeted amplitude so swells feel organic, and a
    // separate `level` that fades in/out with `active` so the bars settle
    // flat (a single low dot) rather than snapping when a clip starts/ends.
    let envelope = 0.4;
    let envelopeTarget = 0.6;
    let level = 0;

    const accent = "#ff3b30"; // Signal Red — the app's single accent
    const dimDot = "rgba(148, 148, 148, 0.55)";
    const gridDot = "rgba(148, 148, 148, 0.16)"; // faint backdrop texture

    // Three sine components at different speeds/wavelengths sum into the same
    // "several waves in one" shape the flowing line used — just sampled per
    // bar column instead of drawn as a continuous stroke.
    const layers = [
      { speed: 1.0, freq: 1.3, amp: 1.0, phase: 0 },
      { speed: 1.7, freq: 2.1, amp: 0.6, phase: 2.1 },
      { speed: 0.6, freq: 0.8, amp: 0.5, phase: 4.2 },
    ];

    const BAR_SPACING = 7; // px between bar columns
    const DOT_GAP = 4.5; // px between stacked dots within a bar
    const DOT_R = 1.3; // foreground dot radius
    const GRID_R = 0.6; // backdrop grid dot radius
    const GRID_SPACING = 6; // px, backdrop texture grid

    function resize(cv: HTMLCanvasElement, c2: CanvasRenderingContext2D) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.max(1, Math.floor(cv.clientWidth * dpr));
      cv.height = Math.max(1, Math.floor(cv.clientHeight * dpr));
      c2.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function barHeight(nx: number, time: number): number {
      let h = 0;
      for (const layer of layers) {
        const win = Math.sin(Math.PI * nx) ** 1.5; // centre-weighted, tapers to the edges
        h += Math.sin(nx * layer.freq * Math.PI * 2 + time * layer.speed * 2 + layer.phase) * layer.amp * win;
      }
      return Math.abs(h) / (1 + 0.6 + 0.5); // normalise against the summed layer amps
    }

    function frame(cv: HTMLCanvasElement, c2: CanvasRenderingContext2D) {
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      const mid = h / 2;
      t += 0.016;

      level += ((activeRef.current ? 1 : 0) - level) * 0.06;
      if (Math.random() < 0.02) envelopeTarget = 0.35 + Math.random() * 0.6;
      envelope += (envelopeTarget - envelope) * 0.05;

      c2.clearRect(0, 0, w, h);

      // Backdrop grid texture — the pixelated-matrix field the bars sit on.
      c2.fillStyle = gridDot;
      for (let gx = GRID_SPACING / 2; gx < w; gx += GRID_SPACING) {
        for (let gy = GRID_SPACING / 2; gy < h; gy += GRID_SPACING) {
          c2.beginPath();
          c2.arc(gx, gy, GRID_R, 0, Math.PI * 2);
          c2.fill();
        }
      }

      const maxAmp = mid * 0.92 * envelope * level;
      const p = Math.min(Math.max(progressRef.current, 0), 1);
      const barCount = Math.max(1, Math.floor(w / BAR_SPACING));

      for (let i = 0; i < barCount; i++) {
        const x = i * BAR_SPACING + BAR_SPACING / 2;
        const nx = x / w;
        const amp = Math.max(2, barHeight(nx, t) * maxAmp);
        const dots = Math.max(1, Math.round(amp / DOT_GAP));
        c2.fillStyle = nx <= p ? accent : dimDot;
        for (let d = 0; d < dots; d++) {
          const y = mid - d * DOT_GAP;
          c2.beginPath();
          c2.arc(x, y, DOT_R, 0, Math.PI * 2);
          c2.fill();
          if (d > 0) {
            // Mirror below the midline too — a symmetric bar, like a real
            // waveform, rather than growing only upward.
            c2.beginPath();
            c2.arc(x, mid + d * DOT_GAP, DOT_R, 0, Math.PI * 2);
            c2.fill();
          }
        }
      }

      raf = requestAnimationFrame(() => frame(cv, c2));
    }

    resize(canvas, ctx);
    const ro = new ResizeObserver(() => resize(canvas, ctx));
    ro.observe(canvas);
    raf = requestAnimationFrame(() => frame(canvas, ctx));

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={`h-8 w-full ${className}`} />;
}
