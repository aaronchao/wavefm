"use client";

import { useEffect, useRef } from "react";

/**
 * Siri-style flowing waveform for the Play bar — several overlapping sine
 * waves with a centre-weighted envelope, painted on a canvas at 60fps.
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
export function SiriWaveform({
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
    // Envelope eased toward a wandering target so swells feel organic, and a
    // separate `level` that fades in/out with `active` so the line settles
    // flat when a clip ends rather than snapping.
    let envelope = 0.4;
    let envelopeTarget = 0.6;
    let level = 0;

    const accent = "#ff3b30"; // Signal Red — the app's single accent
    const dim = "rgba(148, 148, 148, 0.5)";

    // Three sine components at different speeds/wavelengths sum into the Siri
    // "several waves in one" look; each layer is drawn semi-transparent.
    const layers = [
      { speed: 1.0, freq: 1.3, amp: 1.0, phase: 0 },
      { speed: 1.7, freq: 2.1, amp: 0.6, phase: 2.1 },
      { speed: 0.6, freq: 0.8, amp: 0.5, phase: 4.2 },
    ];

    function resize(cv: HTMLCanvasElement, c2: CanvasRenderingContext2D) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.max(1, Math.floor(cv.clientWidth * dpr));
      cv.height = Math.max(1, Math.floor(cv.clientHeight * dpr));
      c2.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function frame(cv: HTMLCanvasElement, c2: CanvasRenderingContext2D) {
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      const mid = h / 2;
      t += 0.016;

      // Ease the level toward 1 while active, 0 when idle (settles flat).
      level += ((activeRef.current ? 1 : 0) - level) * 0.06;

      // Wandering amplitude envelope — re-target occasionally, ease toward it.
      if (Math.random() < 0.02) envelopeTarget = 0.35 + Math.random() * 0.6;
      envelope += (envelopeTarget - envelope) * 0.05;

      c2.clearRect(0, 0, w, h);

      const maxAmp = mid * 0.9 * envelope * level;
      const p = Math.min(Math.max(progressRef.current, 0), 1);
      const step = 2;

      for (const layer of layers) {
        c2.beginPath();
        for (let x = 0; x <= w; x += step) {
          const nx = x / w;
          // Centre-weighted window so the wave bulges in the middle and tapers
          // to the edges, like the Siri line.
          const win = Math.sin(Math.PI * nx) ** 1.5;
          const y =
            mid +
            Math.sin(nx * layer.freq * Math.PI * 2 + t * layer.speed * 2 + layer.phase) *
              maxAmp *
              layer.amp *
              win;
          if (x === 0) c2.moveTo(x, y);
          else c2.lineTo(x, y);
        }
        c2.lineWidth = 2;
        // Travelled portion in accent, the rest dimmed — position feedback
        // without a separate progress bar, as one gradient stroke.
        const grad = c2.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, accent);
        grad.addColorStop(Math.max(0, p - 0.001), accent);
        grad.addColorStop(Math.min(1, p), dim);
        grad.addColorStop(1, dim);
        c2.strokeStyle = grad;
        c2.globalAlpha = layer.amp;
        c2.stroke();
      }
      c2.globalAlpha = 1;

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
