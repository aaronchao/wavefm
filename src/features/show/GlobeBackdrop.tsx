"use client";

import { useEffect, useRef } from "react";
import type { City } from "@/src/core/geo/cities";
import {
  cameraAt,
  capLattice,
  dotCountFor,
  fibonacciSphere,
  project,
  visibleCapDeg,
  type Camera,
  type LatLon,
} from "@/src/core/geo/globeMath";
import { WORLD_CITIES } from "./worldCities";

/**
 * The Show page's background: a dot-matrix globe that, once a location is
 * guessed, flies to that city in one continuous cinematic push — the MIUI 12
 * "Super Wallpaper" move, where the planet is never cut away from, it just
 * keeps growing until its surface fills the frame.
 *
 * Drawn on a plain 2D canvas. It previously used react-globe.gl, which meant
 * three.js — 42MB of dependency for this one component, and a WebGL point
 * cloud that reads as scattered specks rather than the even matrix the
 * Nothing look needs. All the maths is pure and unit-tested in
 * src/core/geo/globeMath.ts; this file is only scheduling and paint.
 *
 * Nothing styling: monochrome dots on the page background, Signal Red
 * reserved for the target alone, so the one red thing on screen is the
 * answer to "where is this from?".
 *
 * Honesty: `target` is null far more often than not — see inferCountry, which
 * refuses to guess from ambiguous script — and the city is a country-level
 * default (see cities.ts), not a claim about a specific studio. When there's
 * no target the globe simply idles, pointing nowhere.
 */

/** Full-globe idle framing, then the close surface framing at the end. */
// Both are fractions of min(viewport). The close framing is deliberately
// under the screen's half-diagonal: past that the limb leaves the frame and
// the globe becomes an edge-to-edge field of dots with no silhouette, which
// stops reading as a planet at all. Keeping the horizon curve in shot is
// what sells "arrived somewhere" over "background texture".
const IDLE_RADIUS_RATIO = 0.30; // a whole planet, out in space
const CLOSE_RADIUS_RATIO = 1.15; // ~3.8x closer: surface, like MIUI's landed frame
const FLY_MS = 4600; // long enough to read as cinematic, not a cut
const IDLE_SPIN_DEG_PER_SEC = 3.2;

export function GlobeBackdrop({ target }: { target: City | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Kept in refs, not state: these change every frame and must never
  // re-render React.
  const camRef = useRef<Camera>({ lat: 8, lon: 0, radius: 0 });
  const flightRef = useRef<{ from: Camera; to: Camera; start: number } | null>(null);
  const targetRef = useRef<City | null>(null);
  const landedRef = useRef(false);

  // Start a flight when the target appears (or changes).
  useEffect(() => {
    targetRef.current = target;
    if (!target) {
      flightRef.current = null;
      landedRef.current = false;
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const min = Math.min(canvas.clientWidth, canvas.clientHeight);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const to: Camera = {
      lat: target.lat,
      lon: target.lon,
      radius: min * CLOSE_RADIUS_RATIO,
    };
    if (reduced) {
      // No journey — just be there. The information still lands; the motion
      // is the part that's unwelcome.
      camRef.current = to;
      landedRef.current = true;
      flightRef.current = null;
      return;
    }
    flightRef.current = { from: { ...camRef.current }, to, start: performance.now() };
    landedRef.current = false;
  }, [target]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    let raf = 0;
    let last = performance.now();
    // Regenerated only when the density bucket or the visible region moves
    // meaningfully — rebuilding the lattice every frame would dominate the
    // frame budget.
    let lattice: LatLon[] = [];
    let latticeKey = "";

    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (camRef.current.radius === 0) {
        camRef.current.radius = Math.min(w, h) * IDLE_RADIUS_RATIO;
      }
    }
    resize();
    window.addEventListener("resize", resize);

    // Read the themed colours once — the canvas can't use CSS variables.
    const css = getComputedStyle(document.documentElement);
    const dotColor = css.getPropertyValue("--foreground").trim() || "#e5e5e5";
    const accent = css.getPropertyValue("--accent").trim() || "#ff3b30";

    function frame(now: number) {
      const dt = Math.min(64, now - last);
      last = now;
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;
      // Offset, not centred: the Show page's info card sits in the middle of
      // the viewport, so a centred globe hides its whole disc behind the card
      // and only leaks a sliver at the edge. Parking it upper-right keeps the
      // silhouette in clear space beside the card on wide screens, and puts
      // the target marker somewhere visible once the camera lands. On narrow
      // screens the card is full-width and it becomes a subtle backdrop
      // either way, which is the right outcome there.
      const cx = w * 0.78;
      const cy = h * 0.34;

      const flight = flightRef.current;
      if (flight) {
        const t = (now - flight.start) / FLY_MS;
        camRef.current = cameraAt(flight.from, flight.to, Math.min(1, t));
        if (t >= 1) {
          flightRef.current = null;
          landedRef.current = true;
        }
      } else if (!reduced) {
        // Idle drift, and a much slower drift once landed — MIUI never fully
        // freezes, which is what keeps it feeling alive rather than a still.
        const speed = landedRef.current ? IDLE_SPIN_DEG_PER_SEC * 0.12 : IDLE_SPIN_DEG_PER_SEC;
        camRef.current.lon = ((camRef.current.lon + (speed * dt) / 1000 + 540) % 360) - 180;
      }

      const cam = camRef.current;
      const wanted = dotCountFor(cam.radius);
      const capDeg = visibleCapDeg(cam.radius, Math.hypot(w, h) / 2);

      // Zoomed out, the whole hemisphere is on screen and one global lattice
      // is right. Zoomed in, only a sliver is visible, so sample just that
      // cap — otherwise nearly every point lands behind the planet or off
      // screen and the matrix thins out into scattered specks.
      const local = capDeg < 60;
      // Quantised so the lattice isn't rebuilt on every sub-degree of drift.
      const key = local
        ? `c:${wanted}:${Math.round(cam.lat)}:${Math.round(cam.lon)}:${Math.round(capDeg)}`
        : `g:${wanted}`;
      if (key !== latticeKey) {
        lattice = local
          ? capLattice(cam.lat, cam.lon, capDeg, wanted)
          : fibonacciSphere(wanted);
        latticeKey = key;
      }

      ctx!.clearRect(0, 0, w, h);

      // The lattice — the globe itself. Zoomed in, the dots cover the whole
      // frame rather than a small disc, so the same opacity that reads as a
      // distant planet becomes a halftone sheet fighting the page text —
      // damp it as the camera closes in.
      const zoomT = Math.min(1, Math.max(0, (cam.radius / Math.min(w, h) - IDLE_RADIUS_RATIO) / (CLOSE_RADIUS_RATIO - IDLE_RADIUS_RATIO)));
      const damp = 1 - 0.35 * zoomT;
      const dotSize = Math.max(0.7, Math.min(2.0, cam.radius / 620));
      ctx!.fillStyle = dotColor;
      for (const p of lattice) {
        const d = project(p, cam.lat, cam.lon, cam.radius, cx, cy);
        if (d.facing <= 0) continue;
        if (d.x < -8 || d.x > w + 8 || d.y < -8 || d.y > h + 8) continue;
        // Fade toward the limb: the sphere reads as round without any
        // shading, purely from dot opacity following the facing term.
        ctx!.globalAlpha = (0.14 + 0.6 * Math.pow(d.facing, 1.5)) * damp;
        ctx!.beginPath();
        ctx!.arc(d.x, d.y, dotSize, 0, Math.PI * 2);
        ctx!.fill();
      }

      // Real cities, slightly brighter than the lattice — actual data, kept
      // from the previous implementation rather than fabricated coastlines.
      ctx!.fillStyle = dotColor;
      for (const c of WORLD_CITIES) {
        const d = project({ lat: c.lat, lon: c.lng }, cam.lat, cam.lon, cam.radius, cx, cy);
        if (d.facing <= 0) continue;
        ctx!.globalAlpha = (0.45 + 0.55 * d.facing) * damp;
        ctx!.beginPath();
        ctx!.arc(d.x, d.y, dotSize * 1.5, 0, Math.PI * 2);
        ctx!.fill();
      }

      // The target: the single red thing on screen.
      const city = targetRef.current;
      if (city) {
        const d = project({ lat: city.lat, lon: city.lon }, cam.lat, cam.lon, cam.radius, cx, cy);
        if (d.facing > 0) {
          ctx!.globalAlpha = 1;
          ctx!.fillStyle = accent;
          ctx!.beginPath();
          ctx!.arc(d.x, d.y, Math.max(3, dotSize * 2.2), 0, Math.PI * 2);
          ctx!.fill();

          // One expanding ring, ~2s — a slow pulse, not a blink.
          const pulse = reduced ? 0 : (now % 2000) / 2000;
          if (pulse > 0) {
            ctx!.globalAlpha = 0.55 * (1 - pulse);
            ctx!.strokeStyle = accent;
            ctx!.lineWidth = 1.5;
            ctx!.beginPath();
            ctx!.arc(d.x, d.y, Math.max(4, dotSize * 2.2) + pulse * 90, 0, Math.PI * 2);
            ctx!.stroke();
          }
        }
      }

      ctx!.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      <canvas ref={canvasRef} className="h-full w-full" />
      {/* No scrim here: the Show page's info block is already a glass-panel
          (its own comment explains why), and stacking a full-canvas wash on
          top of that dimmed the globe to the point of being invisible. */}
    </div>
  );
}
