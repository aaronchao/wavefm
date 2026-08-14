"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import { markFinished, updateEpisodeProgress } from "@/src/data/repos/savedEpisodesRepo";
import { fullPlayer, useFullPlayerState } from "@/src/state/fullPlayer";

/**
 * Drives the full player's <audio> element from fullPlayer's state —
 * genuinely simpler than useClipWindow.ts, since there's no clip-window
 * origin bookkeeping to anchor: the element just plays the real episode
 * from wherever it's told to.
 */
export function useFullPlayback(audioRef: RefObject<HTMLAudioElement | null>) {
  const s = useFullPlayerState();
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const lastSavedAtRef = useRef(0);

  // Load a new source whenever the episode (or a repeat open of the same
  // one, via token) changes. Seeks to the resume position once metadata
  // arrives, then starts playing — open() always sets status "playing".
  useEffect(() => {
    const audio = audioRef.current;
    const meta = s.meta;
    if (!audio || !meta) return;
    const episodeId = meta.episodeId;
    const audioUrl = meta.audioUrl;

    let cancelled = false;
    setCurrentTime(s.startAtSec);
    setDuration(0);
    lastSavedAtRef.current = s.startAtSec;

    function onLoaded() {
      if (cancelled || !audio) return;
      setDuration(audio.duration || 0);
      if (s.startAtSec > 0) {
        try {
          audio.currentTime = s.startAtSec;
        } catch {
          // some streams can't seek before enough has buffered — resume
          // silently fails closed (plays from 0) rather than throwing
        }
      }
      audio.playbackRate = s.playbackRate;
      void audio.play().catch(() => {});
    }
    function onTime() {
      if (cancelled || !audio) return;
      const t = audio.currentTime;
      setCurrentTime(t);
      // Persist at most once every 5s of playback — frequent enough that
      // "resume where you left off" feels accurate, not so frequent it
      // spams the DB on every timeupdate tick (~4/sec in most browsers).
      if (Math.abs(t - lastSavedAtRef.current) >= 5) {
        lastSavedAtRef.current = t;
        void updateEpisodeProgress(episodeId, { positionSec: Math.floor(t), status: "in_progress" });
      }
    }
    function onEnded() {
      if (cancelled) return;
      void markFinished(episodeId, false);
      fullPlayer.close();
    }

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    audio.src = audioUrl;
    audio.load();

    return () => {
      cancelled = true;
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      // Save wherever playback actually stopped, not just the last 5s tick.
      const t = audio.currentTime;
      if (t > 0) void updateEpisodeProgress(episodeId, { positionSec: Math.floor(t) });
      audio.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioRef, s.meta?.audioUrl, s.token]);

  // status (playing/paused) drives the element independently of the load
  // effect above, so toggling play/pause doesn't re-trigger a reload.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !s.meta) return;
    if (s.status === "playing") void audio.play().catch(() => {});
    else if (s.status === "paused") audio.pause();
  }, [audioRef, s.status, s.meta]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = s.playbackRate;
  }, [audioRef, s.playbackRate]);

  // Sleep timer — a single setTimeout re-armed whenever the target
  // changes; cancelling is just setSleepTimer(null), which reruns this
  // effect and clears the pending timeout without firing it.
  useEffect(() => {
    if (!s.sleepTimerEndsAt) return;
    const ms = s.sleepTimerEndsAt - Date.now();
    if (ms <= 0) {
      fullPlayer.pause();
      fullPlayer.setSleepTimer(null);
      return;
    }
    const t = setTimeout(() => {
      fullPlayer.pause();
      fullPlayer.setSleepTimer(null);
    }, ms);
    return () => clearTimeout(t);
  }, [s.sleepTimerEndsAt]);

  function seek(sec: number) {
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = Math.min(Math.max(sec, 0), duration > 0 ? duration : Infinity);
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }

  return { currentTime, duration, seek };
}
