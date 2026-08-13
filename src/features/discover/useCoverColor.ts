"use client";

import { useEffect, useState } from "react";
import { averageRgb, muteColor } from "@/src/core/color/dominantColor";

/**
 * Per-row card tint for XyzrankStackV2, sampled from the show/episode's own
 * cover art — the "color palette based on the original podcast cover art's
 * color" ask, styled after the Braun-product example (each instance themed
 * off its own source image rather than one shared palette).
 *
 * Same CORS reality as DotWaveform's amplitude: cover art comes from
 * third-party CDNs that don't always send an Access-Control-Allow-Origin
 * header, which taints the canvas and blocks pixel reads. That failure is
 * silent and per-image here (unlike audio, most cover CDNs DO allow it), so
 * on failure this just keeps the caller's fallback color rather than
 * breaking the row.
 */
const cache = new Map<string, string>();
const SAMPLE = 16;

export function useCoverColor(url: string | undefined, fallback: string): string {
  // Color is derived from the cache each render, not held in state — the
  // effect below only exists to populate that cache and force one re-render
  // once it does (react-hooks/set-state-in-effect otherwise flags a
  // synchronous setState for the "no url yet" case, same rule ListenInsights
  // ran into with the clock).
  const [, forceRerender] = useState(0);

  useEffect(() => {
    if (!url || cache.has(url)) return;

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = SAMPLE;
        canvas.height = SAMPLE;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
        const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE);
        cache.set(url, muteColor(averageRgb(data)));
      } catch {
        // Tainted canvas — this CDN didn't send a CORS header. Cache the
        // fallback so we don't retry every render, same graceful
        // degradation as DotWaveform's audio analyser.
        cache.set(url, fallback);
      }
      if (!cancelled) forceRerender((n) => n + 1);
    };
    img.onerror = () => {
      cache.set(url, fallback);
      if (!cancelled) forceRerender((n) => n + 1);
    };
    img.src = url;

    return () => {
      cancelled = true;
    };
  }, [url, fallback]);

  if (!url) return fallback;
  return cache.get(url) ?? fallback;
}
