"use client";

import { useSyncExternalStore } from "react";
import { nextSpeed as nextSpeedOf, type Rect } from "@/src/core/player/playerMath";

/**
 * Full in-app playback state — separate from `player.ts` (the 30s preview
 * bar). Deliberately a distinct store rather than extending the preview
 * one: the preview model is built entirely around a fixed clip window
 * (see useClipWindow.ts's own doc comment) and forcing full-episode
 * semantics into that would tangle two different concepts. Only one of
 * the two ever plays audio at a time — FullPlayer.tsx owns that
 * coordination — but each keeps its own simple state shape.
 */

export type FullPlayerMeta = {
  episodeId: string;
  title: string;
  showId?: string;
  showTitle?: string;
  coverUrl?: string;
  audioUrl: string;
  durationSec?: number;
};

export type FullPlayerState = {
  status: "idle" | "playing" | "paused";
  meta: FullPlayerMeta | null;
  /** Where to seek to once the element loads (resume position). */
  startAtSec: number;
  playbackRate: number;
  /** Epoch ms when the sleep timer should pause playback; null = off. */
  sleepTimerEndsAt: number | null;
  /** Bumps on every open() so effects re-run for repeat opens of the same episode. */
  token: number;
  expanded: boolean;
  /** Screen rect of whatever was tapped to expand — the card in Library,
   *  or the mini bar itself when re-expanding. Drives the "grows from
   *  where you tapped" open animation; null falls back to a plain
   *  slide-up (see FullPlayer.tsx). */
  openOriginRect: Rect | null;
};

const initial: FullPlayerState = {
  status: "idle",
  meta: null,
  startAtSec: 0,
  playbackRate: 1,
  sleepTimerEndsAt: null,
  token: 0,
  expanded: false,
  openOriginRect: null,
};

let state: FullPlayerState = initial;
const listeners = new Set<() => void>();

function set(next: Partial<FullPlayerState>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

export const fullPlayer = {
  open(meta: FullPlayerMeta, startAtSec = 0, originRect: Rect | null = null) {
    set({
      status: "playing",
      meta,
      startAtSec,
      sleepTimerEndsAt: null,
      token: state.token + 1,
      expanded: true,
      openOriginRect: originRect,
    });
  },
  play() {
    if (state.meta) set({ status: "playing" });
  },
  pause() {
    if (state.meta) set({ status: "paused" });
  },
  toggle() {
    if (state.status === "playing") fullPlayer.pause();
    else fullPlayer.play();
  },
  close() {
    set({ ...initial, token: state.token + 1 });
  },
  setExpanded(expanded: boolean, originRect: Rect | null = null) {
    set({ expanded, openOriginRect: expanded ? originRect : state.openOriginRect });
  },
  cycleSpeed() {
    set({ playbackRate: nextSpeedOf(state.playbackRate) });
  },
  /** Minutes until auto-pause, or null to cancel. */
  setSleepTimer(minutes: number | null) {
    set({ sleepTimerEndsAt: minutes == null ? null : Date.now() + minutes * 60_000 });
  },
};

export function useFullPlayerState(): FullPlayerState {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => state,
    () => initial,
  );
}
