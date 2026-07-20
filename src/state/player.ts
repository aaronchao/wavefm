"use client";

import { useSyncExternalStore } from "react";

/**
 * Ephemeral preview-player state (never a copy of DB rows). A tiny
 * external store instead of a new dependency — one clip plays at a time,
 * app-wide, surfaced by <PreviewPlayer /> in the root layout.
 */

export type PreviewMeta = {
  /** What the clip is from — episode title, or show title while loading. */
  title: string;
  /** Parent show title when the clip is from an episode. */
  showTitle?: string;
  coverUrl?: string;
  /** Title used for platform search links ("listen in full"). */
  searchTitle: string;
  /** Stored Apple Podcasts URL, when known. */
  appleUrl?: string;
};

export type PlayerState = {
  status: "idle" | "loading" | "playing" | "done" | "error";
  meta: PreviewMeta | null;
  audioUrl: string | null;
  /** Clip start offset in seconds (best-effort fallback). */
  startAt: number;
  /**
   * Optional 0..1 fraction of the real duration to start at, resolved
   * against the CDN's true length on load. Wins over `startAt` when the
   * duration is known — used for "random middle" clips.
   */
  startFraction: number | null;
  /** Bumps on every play request so effects re-run for repeat clicks. */
  token: number;
};

const initial: PlayerState = {
  status: "idle",
  meta: null,
  audioUrl: null,
  startAt: 0,
  startFraction: null,
  token: 0,
};

let state: PlayerState = initial;
const listeners = new Set<() => void>();

function set(next: Partial<PlayerState>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

export const player = {
  /** Show the bar immediately while episode audio is being fetched. */
  startLoading(meta: PreviewMeta) {
    set({
      status: "loading",
      meta,
      audioUrl: null,
      startAt: 0,
      startFraction: null,
      token: state.token + 1,
    });
  },
  /**
   * Start a clip. `meta` refreshes so the bar can show the episode title.
   * `startFraction` (0..1) requests a seek to that share of the real
   * duration — for "random middle" clips — and falls back to `startAt`
   * seconds when the duration can't be read.
   */
  play(meta: PreviewMeta, audioUrl: string, startAt: number, startFraction: number | null = null) {
    set({ status: "playing", meta, audioUrl, startAt, startFraction, token: state.token + 1 });
  },
  /** The 30 seconds ran out — keep the bar (and its links) around. */
  finish() {
    if (state.status === "playing") set({ status: "done" });
  },
  /** No playable audio / playback failed — keep links as the fallback. */
  fail(meta?: PreviewMeta) {
    set({ status: "error", ...(meta ? { meta } : {}), audioUrl: null });
  },
  dismiss() {
    set({ ...initial, token: state.token + 1 });
  },
};

export function usePlayerState(): PlayerState {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => state,
    () => initial,
  );
}
