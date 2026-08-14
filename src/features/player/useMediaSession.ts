"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { listSavedEpisodes } from "@/src/data/repos/savedEpisodesRepo";
import { fullPlayer, useFullPlayerState } from "@/src/state/fullPlayer";

const SKIP_BACK_SEC = 15;
const SKIP_FORWARD_SEC = 30;

function hasMediaSession(): boolean {
  return typeof navigator !== "undefined" && "mediaSession" in navigator;
}

/**
 * Wires the real player into the browser's MediaSession API — lock-screen
 * / notification-shade "now playing" controls, hardware media keys, and
 * Bluetooth headset play/pause/skip buttons all read from this, and iOS
 * bridges Siri's "pause"/"next" voice commands to it too, so this one API
 * covers Aaron's ask (2026-08-14) as far as a web app can reach.
 *
 * Deliberately NOT attempted here: a standalone Google smart speaker (a
 * Nest speaker with no screen) or Gemini controlling this page. Those
 * need a registered Actions-on-Google/Assistant integration or the Cast
 * SDK — a separate platform integration with its own developer-console
 * registration and app review, not something MediaSession (or any web
 * page) gets for free. Flagged in feedback-wavefm.md rather than
 * silently half-building it.
 */
export function useMediaSession(seek: (sec: number) => void, currentTime: number, duration: number) {
  const s = useFullPlayerState();

  const currentTimeRef = useRef(currentTime);
  const seekRef = useRef(seek);
  const activeEpisodeIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);
  useEffect(() => {
    seekRef.current = seek;
  }, [seek]);
  useEffect(() => {
    activeEpisodeIdRef.current = s.meta?.episodeId;
  }, [s.meta?.episodeId]);

  // Same queue the rotary dial picks from — previous/next-track hardware
  // buttons move through the same list, in the same order.
  const episodesQ = useQuery({
    queryKey: ["savedEpisodes"],
    queryFn: listSavedEpisodes,
    staleTime: 60_000,
    enabled: hasMediaSession(),
  });
  const queueRef = useRef(episodesQ.data);
  useEffect(() => {
    queueRef.current = episodesQ.data;
  }, [episodesQ.data]);

  useEffect(() => {
    if (!hasMediaSession()) return;
    const ms = navigator.mediaSession;
    const meta = s.meta;
    if (!meta) {
      ms.metadata = null;
      return;
    }
    ms.metadata = new MediaMetadata({
      title: meta.title,
      artist: meta.showTitle ?? "",
      artwork: meta.coverUrl ? [{ src: meta.coverUrl, sizes: "512x512", type: "image/png" }] : [],
    });
  }, [s.meta]);

  useEffect(() => {
    if (!hasMediaSession()) return;
    navigator.mediaSession.playbackState =
      s.status === "playing" ? "playing" : s.status === "paused" ? "paused" : "none";
  }, [s.status]);

  // Handlers registered once — read latest values through refs rather
  // than depending on currentTime/seek, so a fast-ticking timeupdate
  // doesn't re-register the whole action set every frame.
  useEffect(() => {
    if (!hasMediaSession()) return;
    const ms = navigator.mediaSession;

    function goTrack(direction: 1 | -1) {
      const list = (queueRef.current ?? [])
        .filter((e) => e.bucket === "queue" && e.status !== "finished" && e.audioUrl)
        .sort((a, b) => (a.queueRank ?? 0) - (b.queueRank ?? 0));
      if (list.length === 0) return;
      const idx = Math.max(
        0,
        list.findIndex((e) => e.episodeId === activeEpisodeIdRef.current),
      );
      const next = list[(idx + direction + list.length) % list.length];
      if (next?.audioUrl) {
        fullPlayer.open(
          {
            episodeId: next.episodeId,
            title: next.title,
            showId: next.showId,
            showTitle: next.showTitle,
            coverUrl: next.coverUrl,
            audioUrl: next.audioUrl,
            durationSec: next.durationSec,
          },
          next.positionSec,
        );
      }
    }

    const actions: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => fullPlayer.play()],
      ["pause", () => fullPlayer.pause()],
      ["seekbackward", () => seekRef.current(currentTimeRef.current - SKIP_BACK_SEC)],
      ["seekforward", () => seekRef.current(currentTimeRef.current + SKIP_FORWARD_SEC)],
      [
        "seekto",
        (details) => {
          if (details.seekTime != null) seekRef.current(details.seekTime);
        },
      ],
      ["previoustrack", () => goTrack(-1)],
      ["nexttrack", () => goTrack(1)],
    ];
    for (const [action, handler] of actions) {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        // Not every browser supports every action (e.g. Firefox skips
        // seekto) — skip that one action rather than fail the rest.
      }
    }
    return () => {
      for (const [action] of actions) {
        try {
          ms.setActionHandler(action, null);
        } catch {
          // same as above
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!hasMediaSession() || !("setPositionState" in navigator.mediaSession)) return;
    if (!s.meta || !(duration > 0)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: s.playbackRate,
        position: Math.min(currentTime, duration),
      });
    } catch {
      // Can throw if position momentarily exceeds duration mid-seek.
    }
  }, [currentTime, duration, s.meta, s.playbackRate]);
}
