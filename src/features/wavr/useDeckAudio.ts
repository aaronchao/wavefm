"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clipTarget } from "@/src/core/preview";
import type { WavrCard } from "@/src/core/wavr";
import { planRing, RING_SIZE, type RingSlot } from "@/src/core/wavr/ring";
import { useClipWindow } from "@/src/features/player/useClipWindow";

/**
 * The deck's audio: a three-slot ring of persistent <audio> elements with the
 * card ahead HOT-PARKED, so swiping costs no network round-trip.
 * (docs/wavr-route-design.md §5.2, §5.6, §5.7.)
 *
 * The elements are created here and owned by WavrDeck — they must NEVER be
 * rendered inside the card component, because remounting on every advance
 * gives a fresh element and a full reload, throwing away everything below.
 *
 * Crossfade note: M-W2 ramps element .volume. Once the Web Audio graph lands
 * with the WaveField (M-W5) this upgrades to per-element GainNodes and an
 * equal-power curve; the shape and timings are already the same.
 */

/** How long the outgoing clip takes to fade out (ms). */
const CROSSFADE_MS = 120;
/** Steps in the volume ramp — smooth enough to hear, cheap enough to be free. */
const FADE_STEPS = 8;
/** Grace period before the outgoing element is paused. */
const FADE_SETTLE_MS = 140;
/** Clips start in the central fifth; see core/preview.middleFraction. */
const CLIP_FRACTION = 0.4;

export type PlayState =
  | "locked"
  | "loading"
  | "playing"
  | "paused"
  | "unavailable";

export type DeckAudio = {
  playState: PlayState;
  /** 0..1 through the 30s clip. */
  progress: number;
  /** The CDN couldn't seek; the clip is running from 0:00. */
  fromStart: boolean;
  /** False until a user gesture has granted audio playback. */
  unlocked: boolean;
  /**
   * Call from inside a user gesture. Grants playback for the session and
   * starts the current card. Safe to call repeatedly.
   */
  unlock: () => void;
  togglePlay: () => void;
  replay: () => void;
  /**
   * Start the swap clock. Call on DECIDE, not after the exit animation — the
   * next clip should be audible while the old card is still flying off (§6.5).
   * The ring itself turns off the `index` prop.
   */
  markAdvance: () => void;
  /** Duck to a fraction of full volume (the overview holds at 0.25, §6.7). */
  setDuck: (level: number) => void;
  /** Milliseconds from the last advance to audible playback; null until measured. */
  lastSwapMs: number | null;
  /** Attach to the three <audio> elements WavrDeck renders. */
  register: (slot: RingSlot) => (el: HTMLAudioElement | null) => void;
  slots: RingSlot[];
};

const SESSION_KEY = "wavr.audio.unlocked";

function readUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function useDeckAudio(cards: WavrCard[], index: number): DeckAudio {
  const els = useRef<(HTMLAudioElement | null)[]>([null, null, null]);
  /** Stable ref object handed to useClipWindow; retargeted as the ring turns. */
  const activeRef = useRef<HTMLAudioElement | null>(null);
  /** Dedupe guard for park(); mirrored into state for render-time reads. */
  const primedRef = useRef<(string | null)[]>([null, null, null]);
  const swapStartedAt = useRef<number | null>(null);
  const duck = useRef(1);

  const [primedUrls, setPrimedUrls] = useState<(string | null)[]>([null, null, null]);
  const [unlocked, setUnlocked] = useState(readUnlocked);
  const [lastSwapMs, setLastSwapMs] = useState<number | null>(null);
  /**
   * Paused/failed are stored as the deck position they happened at, so moving
   * to another card clears them without an effect that resets state.
   */
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [failedAt, setFailedAt] = useState<number | null>(null);
  /** Bumps to re-arm the window for a replay of the SAME clip. */
  const [replayToken, setReplayToken] = useState(0);

  const plan = useMemo(() => planRing(cards.length, index), [cards.length, index]);
  const curSlot = plan.find((p) => p.role === "cur")!.slot;
  const card = cards[index];
  const paused = pausedAt === index;
  const failed = failedAt === index;

  const register = useCallback(
    (slot: RingSlot) => (el: HTMLAudioElement | null) => {
      els.current[slot] = el;
    },
    [],
  );

  /**
   * Hot-park a card on a slot: assign src, load metadata, seek past the Range
   * round-trip, and warm the decoder with a muted play/pause cycle. After
   * this the element is decoded, buffered and sitting on the clip origin, so
   * promoting it is a play() that starts within one audio callback.
   */
  const park = useCallback((slot: RingSlot, target: WavrCard | undefined) => {
    const el = els.current[slot];
    if (!el) return;
    const url = target?.audioUrl ?? null;
    if (primedRef.current[slot] === url) return; // already parked on this card
    primedRef.current = primedRef.current.map((u, i) => (i === slot ? url : u));
    setPrimedUrls(primedRef.current);

    el.pause();
    if (!url) {
      el.removeAttribute("src");
      return;
    }
    el.muted = true;
    el.preload = "auto";
    el.src = url;

    const onMeta = () => {
      el.removeEventListener("loadedmetadata", onMeta);
      const at = clipTarget(el.duration, 0, CLIP_FRACTION);
      try {
        el.currentTime = at;
      } catch {
        // non-seekable stream: it will simply start from 0
      }
      // warm the decoder, then park back on the origin
      void el
        .play()
        .then(() => {
          el.pause();
          try {
            el.currentTime = at;
          } catch {
            /* as above */
          }
        })
        .catch(() => {
          // no activation grant yet — the element is still loaded and seeked,
          // which is the expensive part. Playback is granted on unlock().
        });
    };
    el.addEventListener("loadedmetadata", onMeta);
    el.load();
  }, []);

  // Keep prev/cur/next parked. `prev` deliberately keeps its src so undo is
  // instant; only the slot two cards back is ever re-primed.
  useEffect(() => {
    for (const a of plan) {
      if (a.role === "cur") continue; // the window owns the playing element
      park(a.slot, a.occupied ? cards[a.cardIndex] : undefined);
    }
  }, [plan, cards, park]);

  // Retarget the clip window at whichever element currently holds `cur`.
  // Registered BEFORE useClipWindow so it runs first on every render.
  useEffect(() => {
    activeRef.current = els.current[curSlot];
  });

  const rampVolume = useCallback((el: HTMLAudioElement, to: number) => {
    const from = el.volume;
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      el.volume = Math.min(1, Math.max(0, from + (to - from) * (step / FADE_STEPS)));
      if (step >= FADE_STEPS) clearInterval(timer);
    }, CROSSFADE_MS / FADE_STEPS);
    return () => clearInterval(timer);
  }, []);

  const onFinish = useCallback(() => setPausedAt(index), [index]);
  const onError = useCallback(() => setFailedAt(index), [index]);

  const playable = Boolean(card?.audioUrl);
  const active = unlocked && !paused && !failed && playable;

  const { progress, fromStart } = useClipWindow(
    activeRef,
    active && card?.audioUrl
      ? {
          audioUrl: card.audioUrl,
          startAt: 0,
          startFraction: CLIP_FRACTION,
          token: replayToken,
          // hot-parked already: skip the reload and the re-seek
          preloaded: primedUrls[curSlot] === card.audioUrl,
        }
      : null,
    { onFinish, onError },
  );

  // Fade the promoted element in, fade and pause the demoted ones, and record
  // how long the swap actually took.
  useEffect(() => {
    const el = els.current[curSlot];
    if (!el || !active) return;
    el.muted = false;
    el.volume = 0;
    const stopIn = rampVolume(el, duck.current);

    const others = els.current.filter(
      (o, i): o is HTMLAudioElement => Boolean(o) && i !== curSlot,
    );
    const stopOut = others.map((o) => rampVolume(o, 0));
    const settle = setTimeout(() => {
      for (const o of others) o.pause();
    }, FADE_SETTLE_MS);

    const measure = () => {
      if (swapStartedAt.current === null) return;
      setLastSwapMs(Math.round(performance.now() - swapStartedAt.current));
      swapStartedAt.current = null;
    };
    el.addEventListener("playing", measure);

    return () => {
      stopIn();
      for (const s of stopOut) s();
      clearTimeout(settle);
      el.removeEventListener("playing", measure);
    };
  }, [curSlot, replayToken, active, rampVolume]);

  const markAdvance = useCallback(() => {
    swapStartedAt.current = performance.now();
  }, []);

  const unlock = useCallback(() => {
    setUnlocked((was) => {
      if (was) return was;
      try {
        window.sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        // private mode — the grant just won't survive a reload
      }
      return true;
    });
    setPausedAt(null);
    setFailedAt(null);
    setReplayToken((t) => t + 1);
  }, []);

  const togglePlay = useCallback(() => {
    if (!unlocked) return unlock();
    setPausedAt((at) => (at === index ? null : index));
    setReplayToken((t) => t + 1);
  }, [unlocked, unlock, index]);

  const replay = useCallback(() => {
    setPausedAt(null);
    setFailedAt(null);
    setReplayToken((t) => t + 1);
  }, []);

  const setDuck = useCallback(
    (level: number) => {
      duck.current = Math.min(1, Math.max(0, level));
      const el = els.current[curSlot];
      if (el) rampVolume(el, duck.current);
    },
    [curSlot, rampVolume],
  );

  const playState: PlayState = !playable || failed
    ? "unavailable"
    : !unlocked
      ? "locked"
      : paused
        ? "paused"
        : progress > 0
          ? "playing"
          : "loading";

  return {
    playState,
    progress,
    fromStart,
    unlocked,
    unlock,
    togglePlay,
    replay,
    markAdvance,
    setDuck,
    lastSwapMs,
    register,
    slots: Array.from({ length: RING_SIZE }, (_, i) => i as RingSlot),
  };
}
