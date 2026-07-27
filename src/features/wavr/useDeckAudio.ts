"use client";

import { useCallback, useState, type RefObject } from "react";
import type { WavrCard } from "@/src/core/wavr";
import { seedFromId, wavrClipStart, WAVR_CLIP_SEC, WAVR_PLAYBACK_RATE } from "@/src/core/wavr";
import { useClipWindow } from "@/src/features/player/useClipWindow";

/**
 * The deck's audio — ONE <audio> element driven by useClipWindow, the exact
 * mechanism the app-wide Play bar (PreviewPlayer) and "Wavr Mini" already use
 * successfully. It replaced a three-slot hot-parking ring that, in practice,
 * was the source of the deck's two worst bugs: it gated the first play behind
 * a session "unlock" round-trip and ran muted warm-up loads that competed for
 * bandwidth (audio often never started), and it seeked minutes-deep into each
 * episode (slow CDN Range responses → long load). A single element that just
 * loads, seeks shallow, and plays is both simpler and faster.
 *
 * Swaps aren't pre-warmed anymore, so each card loads its clip when it becomes
 * current — the same per-card load Wavr Mini has, which is fast enough because
 * the clip now starts just past the intro (wavrClipStart), not deep in.
 */

export type PlayState = "locked" | "loading" | "playing" | "paused" | "unavailable";

export type DeckAudio = {
  playState: PlayState;
  /** 0..1 through the clip. */
  progress: number;
  /** Drag-to-seek: jump to a 0..1 point within the clip. */
  seekTo: (fraction: number) => void;
  /** Tap the card: pause if playing, resume if paused, grant if autoplay-blocked. */
  togglePlay: () => void;
  /** Set output volume 0..1 (the overview ducks to 0.25 while you choose). */
  setVolume: (level: number) => void;
};

/**
 * `elRef` is OWNED by the caller (WavrDeck renders the single `<audio>` and
 * holds its ref) — the hook only reads it. Keeping the element ref out of the
 * hook's return value is deliberate: a value used as a JSX `ref` must not also
 * have its data read during render, so returning a ref-setter here would taint
 * the whole DeckAudio object for the rules-of-refs lint.
 */
export function useDeckAudio(
  elRef: RefObject<HTMLAudioElement | null>,
  card: WavrCard | undefined,
  { onEnded }: { onEnded?: () => void } = {},
): DeckAudio {
  const cardId = card?.id;
  const audioUrl = card?.audioUrl;

  // Each transient is stored AS the card id it applies to, not a bare bool, so
  // moving to a new card resets all of them for free (no reset effect, which
  // the lint rightly flags as a cascading render). Mirrors the old ring's
  // `pausedAt === index` trick.
  const [pausedFor, setPausedFor] = useState<string | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const [blockedFor, setBlockedFor] = useState<string | null>(null);
  /** Bumps to re-arm useClipWindow (resume-after-block). */
  const [token, setToken] = useState(0);

  const paused = pausedFor != null && pausedFor === cardId;
  const failed = failedFor != null && failedFor === cardId;
  const blocked = blockedFor != null && blockedFor === cardId;

  // Stable across renders unless the card changes — an inline arrow would give
  // useClipWindow's effect a fresh dependency every render, tearing down and
  // restarting the load/seek/play cycle in a loop.
  const resolveStart = useCallback(
    (duration: number) => wavrClipStart(duration, seedFromId(cardId ?? "")),
    [cardId],
  );

  const onFinish = useCallback(() => {
    onEnded?.();
  }, [onEnded]);

  const onError = useCallback(
    (err?: unknown) => {
      if (cardId == null) return;
      // A play() rejection before anything played is almost always the
      // browser's autoplay policy, not a broken stream — show a quiet "Tap to
      // listen" rather than "preview unavailable", and let the tap grant it.
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setBlockedFor(cardId);
      } else {
        setFailedFor(cardId);
      }
    },
    [cardId],
  );

  const { progress, seek } = useClipWindow(
    elRef,
    audioUrl && !failed && !blocked
      ? {
          audioUrl,
          startAt: 0,
          startFraction: null,
          resolveStart,
          clipLenSec: WAVR_CLIP_SEC,
          playbackRate: WAVR_PLAYBACK_RATE,
          token,
        }
      : null,
    { onFinish, onError },
  );

  const togglePlay = useCallback(() => {
    if (cardId == null) return;
    // After an autoplay block, the tap is the grant — re-arm and let
    // useClipWindow play from inside this gesture.
    if (blocked) {
      setBlockedFor(null);
      setToken((t) => t + 1);
      return;
    }
    const el = elRef.current;
    if (!el) return;
    // Pause/resume directly on the element so the clip continues from where it
    // stopped (toggling the useClipWindow source would restart it from origin).
    if (el.paused) {
      setPausedFor(null);
      void el.play().catch(() => setFailedFor(cardId));
    } else {
      setPausedFor(cardId);
      el.pause();
    }
  }, [blocked, cardId, elRef]);

  const setVolume = useCallback(
    (level: number) => {
      const el = elRef.current;
      if (el) el.volume = Math.min(1, Math.max(0, level));
    },
    [elRef],
  );

  const playState: PlayState = !audioUrl || failed
    ? "unavailable"
    : blocked
      ? "locked"
      : paused
        ? "paused"
        : progress > 0
          ? "playing"
          : "loading";

  return { playState, progress, seekTo: seek, togglePlay, setVolume };
}
