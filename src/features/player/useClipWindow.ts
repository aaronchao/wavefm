"use client";

import { type RefObject, useEffect, useState } from "react";
import { CLIP_SECONDS, clipTarget } from "@/src/core/preview";

/**
 * The 30-second clip window: seek to the intended origin, anchor the window
 * to where playback ACTUALLY lands, report progress, and stop at the end.
 *
 * Lifted verbatim out of PreviewPlayer so the Wavr deck's audio ring shares
 * this bookkeeping rather than growing a second, subtly different copy. The
 * awkward parts are all load-bearing:
 *
 *   - a CDN that ignores Range can't seek, so the clip has to be measured
 *     from wherever playback really started, not from what we asked for;
 *   - when a seek WAS requested we must wait for `seeked`, because the
 *     pre-seek `timeupdate` at 0 would otherwise end the clip immediately;
 *   - some streams never fire `seeked` at all, hence the 3s fallback anchor;
 *   - an unknown (NaN) duration must not collapse the target to 0.
 */

export type ClipSource = {
  audioUrl: string;
  /** Intended start offset in seconds. */
  startAt: number;
  /** Optional 0..1 share of the real duration; wins when the length is known. */
  startFraction: number | null;
  /** Bumps on every play request, so repeats of the same URL re-run. */
  token: number;
  /**
   * The element already holds this src and is parked at the target (the
   * deck's hot-parking, §5.2). Skips the load + seek and plays immediately.
   */
  preloaded?: boolean;
};

export type ClipWindow = {
  /** 0..1 through the clip. */
  progress: number;
  /** True when the CDN couldn't seek and the clip is running from 0:00. */
  fromStart: boolean;
};

export type ClipHandlers = {
  onFinish: () => void;
  onError: () => void;
};

/** Pass `source: null` to stop and release the element. */
export function useClipWindow(
  audioRef: RefObject<HTMLAudioElement | null>,
  source: ClipSource | null,
  handlers: ClipHandlers,
): ClipWindow {
  const [progress, setProgress] = useState(0);
  const [fromStart, setFromStart] = useState(false);

  const audioUrl = source?.audioUrl ?? null;
  const startAt = source?.startAt ?? 0;
  const startFraction = source?.startFraction ?? null;
  const token = source?.token ?? 0;
  const preloaded = source?.preloaded ?? false;
  const { onFinish, onError } = handlers;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setProgress(0);
    setFromStart(false);

    if (!audioUrl) {
      audio.pause();
      audio.removeAttribute("src");
      return;
    }

    // intended seek target; the ACTUAL clip origin is captured once playback
    // settles so the 30s window is correct even when the CDN can't seek.
    let target = startAt;
    let seekRequested = false;
    let decided = false;
    let origin: number | null = null;
    let cancelled = false;
    let fallback: ReturnType<typeof setTimeout> | undefined;

    // Anchor the 30s window to the real playback position, whatever it turns
    // out to be — the requested offset on a Range-capable CDN, or 0 when the
    // CDN can't seek. Set exactly once.
    const anchor = (at: number) => {
      if (cancelled || origin !== null) return;
      origin = at;
      if (target - at > 5) setFromStart(true);
    };

    const onLoaded = () => {
      if (cancelled) return;
      target = clipTarget(audio.duration, startAt, startFraction);
      // a hot-parked element is already sitting at the target; re-seeking it
      // would throw away the Range round-trip we paid for during prefetch
      seekRequested = !preloaded && target > 0.5;
      if (seekRequested) {
        // best-effort seek; anchored by onSeeked once it settles
        try {
          audio.currentTime = target;
        } catch {
          seekRequested = false;
        }
      }
      // the seek is now classified — onTime may anchor from here on
      decided = true;
      audio.play().catch(() => {
        if (!cancelled) onError();
      });
      // safety net: if 'seeked' never fires (some non-seekable streams),
      // anchor to wherever we are after a moment
      fallback = setTimeout(() => anchor(audio.currentTime), 3000);
    };

    // when a seek was requested, THIS is the trusted origin — waiting for it
    // avoids the pre-seek `timeupdate` at 0 that would end the clip early
    const onSeeked = () => {
      if (seekRequested) anchor(audio.currentTime);
    };

    const onTime = () => {
      if (cancelled || !decided) return; // wait for onLoaded
      // no seek requested -> first playback position is the origin;
      // seek requested -> hold until onSeeked/fallback anchors it
      if (origin === null) {
        if (!seekRequested) anchor(audio.currentTime);
        else return;
      }
      const elapsed = audio.currentTime - origin!;
      setProgress(Math.min(Math.max(elapsed / CLIP_SECONDS, 0), 1));
      if (elapsed >= CLIP_SECONDS) {
        audio.pause();
        onFinish();
      }
    };

    const onEnded = () => !cancelled && onFinish();
    const onErrorEvent = () => !cancelled && onError();

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("seeked", onSeeked);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onErrorEvent);

    if (preloaded && audio.readyState >= 1) {
      // metadata already arrived during prefetch, so `loadedmetadata` will
      // not fire again — run the same body now rather than wait forever
      onLoaded();
    } else {
      if (!preloaded) audio.src = audioUrl;
      audio.load();
    }

    return () => {
      cancelled = true;
      if (fallback) clearTimeout(fallback);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("seeked", onSeeked);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onErrorEvent);
      audio.pause();
    };
    // token bumps on every play request, even for the same URL
  }, [audioRef, token, audioUrl, startAt, startFraction, preloaded, onFinish, onError]);

  return { progress, fromStart };
}
