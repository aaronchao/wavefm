"use client";

import { useCallback, useEffect, useRef } from "react";
import { probeHostCors } from "./corsProbe";
import type { DeckAudio } from "./useDeckAudio";

/** 64 FFT bins, low 32 used — mirrored horizontally so bass sits centre-stage. */
const BINS = 32;
const FFT_SIZE = 128;

type Graph = {
  ctx: AudioContext;
  analyser: AnalyserNode;
  /** Per ring slot: the tap, and whether its host cleared the CORS probe. */
  sources: (MediaElementAudioSourceNode | null)[];
  tierA: boolean[];
  bytes: Uint8Array<ArrayBuffer>;
};

export type WaveAnalyser = {
  /** Called from WaveField's own rAF loop — never triggers a React render. */
  getFrame: () => Float32Array;
};

/**
 * Builds the (lazy, one-time) Web Audio tap on the deck's three <audio>
 * elements and returns an imperative `getFrame()`. Deliberately holds no
 * per-frame React state: a 60fps `setState` here would re-render the whole
 * deck for a background visual (§11 perf budget — one rAF loop, not one per
 * consumer). Tier A (real analysis) is used only for a slot whose host
 * cleared the CORS probe; every other slot falls back to a deterministic,
 * playback-driven synthesis with the exact same frame shape (§6.6) — the
 * fallback is honest ambient motion design, not fabricated spectrum data.
 */
export function useWaveAnalyser(audio: DeckAudio, cardId: string | undefined): WaveAnalyser {
  const graphRef = useRef<Graph | null>(null);
  const frame = useRef(new Float32Array(BINS));

  // The graph is created lazily inside the unlock gesture: AudioContext
  // starts `suspended` without user activation, and MediaElementAudioSourceNode
  // is one-per-element for life, so all three are tapped exactly once.
  useEffect(() => {
    if (!audio.unlocked || graphRef.current || typeof window === "undefined") return;
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return; // no Web Audio support — Tier B only, forever
    try {
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.8;
      void ctx.resume();
      graphRef.current = {
        ctx,
        analyser,
        sources: [null, null, null],
        tierA: [false, false, false],
        bytes: new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount)),
      };
    } catch {
      // Web Audio unavailable — every slot stays Tier B
    }
  }, [audio.unlocked]);

  // Tap each element the first time it carries a real src. Cheap to re-run
  // (no-ops once a slot is tapped), so no dependency array is needed beyond
  // "every render" — the elements themselves are stable refs.
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    audio.elementsRef.current.forEach((el, slot) => {
      if (!el || !el.src || graph.sources[slot]) return;
      const url = el.src;
      void probeHostCors(url).then((ok) => {
        if (graph.sources[slot]) return; // tapped by a later effect run already
        if (ok) el.crossOrigin = "anonymous";
        try {
          const src = graph.ctx.createMediaElementSource(el);
          src.connect(graph.analyser);
          graph.analyser.connect(graph.ctx.destination);
          graph.sources[slot] = src;
          graph.tierA[slot] = ok;
        } catch {
          // already tapped elsewhere, or a tainted load slipped through —
          // this slot just stays on Tier B
        }
      });
    });
  });

  const getFrame = useCallback((): Float32Array => {
    const graph = graphRef.current;
    const tierA = Boolean(graph?.tierA[audio.curSlot]);
    if (graph && tierA) {
      graph.analyser.getByteFrequencyData(graph.bytes);
      for (let i = 0; i < BINS; i++) frame.current[i] = (graph.bytes[i] ?? 0) / 255;
    } else {
      synthFrame(cardId ?? "", audio.progress, audio.playState === "playing", frame.current);
    }
    return frame.current;
    // curSlot/progress/playState are read fresh on every call, not via deps —
    // getFrame is invoked from WaveField's own rAF loop, not from React state.
  }, [audio, cardId]);

  return { getFrame };
}

/**
 * Deterministic band envelope seeded by the card id, advanced by playback
 * progress. Same card -> same look; idle settles to a resting drift rather
 * than freezing (a frozen field reads as broken, not paused).
 */
function synthFrame(seed: string, progress: number, playing: boolean, out: Float32Array): void {
  const h = hash(seed);
  const t = progress * 30; // seconds elapsed through the clip
  for (let i = 0; i < out.length; i++) {
    const phase = (h % 97) / 97 + i * 0.13 + t * 0.6;
    const wave = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
    out[i] = playing ? 0.3 + 0.7 * wave : 0.06 + 0.04 * wave;
  }
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
