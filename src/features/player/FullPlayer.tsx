"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { originTransform } from "@/src/core/player/playerMath";
import {
  isEpisodeSaved,
  listSavedEpisodes,
  removeEpisode,
  saveEpisode,
  type SavedEpisode,
} from "@/src/data/repos/savedEpisodesRepo";
import { usePlayerState } from "@/src/state/player";
import { fullPlayer, useFullPlayerState } from "@/src/state/fullPlayer";
import { springs } from "@/src/ui/tokens";
import { PlayerWaveformScrubber } from "./PlayerWaveformScrubber";
import { TwoDialPicker } from "./TwoDialPicker";
import { useFullPlayback } from "./useFullPlayback";
import { useMediaSession } from "./useMediaSession";
import { useRotaryDial } from "./useRotaryDial";

const SKIP_BACK_SEC = 15;
const SKIP_FORWARD_SEC = 30;
const SLEEP_CYCLE_MIN = [null, 15, 30, 45, 60] as const;

function queueOf(episodes: SavedEpisode[] | undefined): SavedEpisode[] {
  return (episodes ?? [])
    .filter((e) => e.bucket === "queue" && e.status !== "finished" && e.audioUrl)
    .sort((a, b) => (a.queueRank ?? 0) - (b.queueRank ?? 0));
}

/**
 * Real in-app playback — Aaron's own ask (2026-08-14): "tired of keep
 * going to other podcast player and come back, and they are not fully
 * synced." Opened from a saved episode in the Library (see
 * EpisodeCard.tsx).
 *
 * Redesigned 2026-08-16 to follow Aaron's own reference photos: one
 * persistent widget (not a collapsed-bar/fullscreen-player two-tier
 * split like the first cut) — top row of metadata + save + volume,
 * middle the dot-matrix waveform (also the scrubber), right a 2x2 grid
 * (back/forward/save/play), left a circle showing your position in the
 * queue. Long-hold-drag-release that left circle for the rotary dial
 * page (TwoDialPicker) — a continuous single gesture per Aaron's exact
 * spec, not tap-then-separate-drag.
 */
export function FullPlayer() {
  const s = useFullPlayerState();
  const previewState = usePlayerState();
  const audioRef = useRef<HTMLAudioElement>(null);
  const { currentTime, duration, seek, volume, setVolume } = useFullPlayback(audioRef);
  useMediaSession(seek, currentTime, duration);
  const widgetRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sleepRemainingMin, setSleepRemainingMin] = useState<number | null>(null);

  // Off -> 15 -> 30 -> 45 -> 60 -> off. Tracked by minutes-remaining-at-tap
  // (rounded) rather than a stored preset index, since the store only
  // remembers an end timestamp — reading Date.now() here is fine, this
  // runs from a click handler, not render.
  function cycleSleepTimer() {
    const remaining = s.sleepTimerEndsAt == null ? null : Math.ceil((s.sleepTimerEndsAt - Date.now()) / 60_000);
    const idx = remaining == null ? -1 : SLEEP_CYCLE_MIN.findIndex((m) => m != null && Math.abs(m - remaining) <= 2);
    const next = SLEEP_CYCLE_MIN[(idx + 2) % SLEEP_CYCLE_MIN.length];
    fullPlayer.setSleepTimer(next);
  }

  // Ticks the sleep-timer display once a timer is running. setState only
  // ever fires from inside the interval callback, never synchronously in
  // the effect body (same react-hooks/purity rule the first player cut's
  // clock display hit) — the "off" case is handled by reading
  // s.sleepTimerEndsAt directly at render time instead (see sleepLabel
  // below), not by resetting this state here.
  useEffect(() => {
    const endsAt = s.sleepTimerEndsAt;
    if (endsAt == null) return;
    const id = setInterval(() => {
      setSleepRemainingMin(Math.max(0, Math.ceil((endsAt - Date.now()) / 60_000)));
    }, 1000);
    return () => clearInterval(id);
  }, [s.sleepTimerEndsAt]);

  const episodesQ = useQuery({
    queryKey: ["savedEpisodes"],
    queryFn: listSavedEpisodes,
    staleTime: 60_000,
  });
  const queue = queueOf(episodesQ.data);
  const currentIndex = Math.max(
    0,
    queue.findIndex((e) => e.episodeId === s.meta?.episodeId),
  );

  function switchTo(episode: SavedEpisode) {
    if (!episode.audioUrl) return;
    fullPlayer.open(
      {
        episodeId: episode.episodeId,
        title: episode.title,
        showId: episode.showId,
        showTitle: episode.showTitle,
        coverUrl: episode.coverUrl,
        audioUrl: episode.audioUrl,
        durationSec: episode.durationSec,
      },
      episode.positionSec,
    );
  }

  const rotary = useRotaryDial(queue.length, currentIndex, (index) => {
    const chosen = queue[index];
    if (chosen && chosen.episodeId !== s.meta?.episodeId) switchTo(chosen);
  });

  useEffect(() => {
    const id = s.meta?.episodeId;
    if (!id) return;
    let cancelled = false;
    void isEpisodeSaved(id).then((v) => !cancelled && setSaved(v));
    return () => {
      cancelled = true;
    };
  }, [s.meta?.episodeId]);

  function toggleSaved() {
    const meta = s.meta;
    if (!meta) return;
    const next = !saved;
    setSaved(next);
    void (next
      ? saveEpisode({
          id: meta.episodeId,
          title: meta.title,
          showId: meta.showId,
          showTitle: meta.showTitle,
          coverUrl: meta.coverUrl,
          audioUrl: meta.audioUrl,
          durationSec: meta.durationSec,
          categories: [],
        })
      : removeEpisode(meta.episodeId)
    ).then(() => queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] }));
  }

  // A preview clip starting elsewhere takes over the one audio channel a
  // person actually has — pause full playback rather than let both race.
  useEffect(() => {
    if (previewState.status !== "idle" && s.status === "playing") fullPlayer.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewState.status]);

  useEffect(() => {
    if (!rotary.active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [rotary.active]);

  if (!s.meta) return <audio ref={audioRef} preload="none" />;

  const meta = s.meta;
  const playing = s.status === "playing";
  const originT =
    s.openOriginRect && typeof window !== "undefined"
      ? originTransform(s.openOriginRect, window.innerWidth, window.innerHeight)
      : null;

  return (
    <>
      <audio ref={audioRef} preload="none" />
      <motion.div
        ref={widgetRef}
        // One-time "grows from the tapped Library card" entrance — only
        // applies at mount (Framer ignores `initial` on re-renders), so
        // switching tracks afterward never replays it.
        initial={originT ? { ...originT, borderRadius: 28, opacity: 0.6 } : { y: 96, opacity: 0 }}
        animate={{ x: 0, y: 0, scaleX: 1, scaleY: 1, borderRadius: 24, opacity: 1 }}
        exit={{ y: 96, opacity: 0 }}
        transition={springs.settle}
        style={{ transformOrigin: "center" }}
        className="fixed inset-x-3 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.5rem)] z-[45] overflow-hidden border border-white/30 bg-white/40 backdrop-blur-md dark:border-white/10 dark:bg-black/50 sm:inset-x-8"
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-2 p-3">
          {/* Top row: title/show, save, volume, close. */}
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{meta.title}</p>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{meta.showTitle}</p>
            </div>
            <VolumeControl volume={volume} onChange={setVolume} />
            <button
              type="button"
              onClick={() => fullPlayer.close()}
              aria-label="Close player"
              className="shrink-0 rounded-full px-1.5 py-1 text-muted-foreground hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              ✕
            </button>
          </div>

          {/* Main row: left dial-trigger circle | waveform | right 2x2 icons. */}
          <div className="flex items-center gap-3">
            <div
              {...rotary.handlers}
              role="button"
              aria-label="Hold to choose a different saved episode"
              tabIndex={0}
              className="nothing-circle flex h-16 w-16 shrink-0 touch-none select-none flex-col items-center justify-center"
            >
              <span className="font-brand text-base font-black leading-none tabular-nums">
                {queue.length > 0 ? currentIndex + 1 : "–"}
              </span>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                of {queue.length || "–"}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <PlayerWaveformScrubber active={playing} currentTime={currentTime} duration={duration} onSeek={seek} />
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => seek(currentTime - SKIP_BACK_SEC)}
                aria-label={`Back ${SKIP_BACK_SEC} seconds`}
                className="nothing-circle flex h-8 w-8 items-center justify-center"
              >
                <SkipBackIcon />
              </button>
              <button
                type="button"
                onClick={() => seek(currentTime + SKIP_FORWARD_SEC)}
                aria-label={`Forward ${SKIP_FORWARD_SEC} seconds`}
                className="nothing-circle flex h-8 w-8 items-center justify-center"
              >
                <SkipForwardIcon />
              </button>
              <button
                type="button"
                onClick={toggleSaved}
                aria-label={saved ? "Remove from saved" : "Save"}
                data-active={saved}
                className="nothing-circle flex h-8 w-8 items-center justify-center"
              >
                {saved ? "✓" : "+"}
              </button>
              <button
                type="button"
                onClick={() => fullPlayer.toggle()}
                aria-label={playing ? "Pause" : "Play"}
                className="nothing-circle flex h-8 w-8 items-center justify-center"
              >
                {playing ? <PauseIcon /> : <PlayIcon />}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {rotary.active && (
          <TwoDialPicker
            list={queue}
            index={rotary.index}
            currentTime={currentTime}
            duration={duration}
            onSeek={seek}
            playbackRate={s.playbackRate}
            onCycleSpeed={() => fullPlayer.cycleSpeed()}
            onOpenPlaylist={() => setPlaylistOpen(true)}
            sleepLabel={s.sleepTimerEndsAt != null ? `${sleepRemainingMin ?? "…"}m` : "Timer"}
            onCycleSleep={cycleSleepTimer}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {playlistOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex flex-col bg-background"
          >
            <div className="flex items-center justify-between border-b border-surface-border px-4 py-3 sm:px-8">
              <p className="font-brand text-sm font-bold uppercase tracking-wider">Playlist</p>
              <button
                type="button"
                onClick={() => setPlaylistOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close playlist"
              >
                ✕
              </button>
            </div>
            <ul className="flex-1 overflow-y-auto px-4 py-4 sm:px-8">
              {queue.map((ep, i) => (
                <li key={ep.episodeId}>
                  <button
                    type="button"
                    onClick={() => {
                      switchTo(ep);
                      setPlaylistOpen(false);
                    }}
                    className={`flex w-full flex-col gap-0.5 rounded-card px-3 py-2.5 text-left hover:bg-accent-soft ${
                      i === currentIndex ? "bg-accent-soft" : ""
                    }`}
                  >
                    <span className="line-clamp-1 text-sm font-semibold">{ep.title}</span>
                    <span className="line-clamp-1 text-xs text-muted-foreground">{ep.showTitle}</span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function VolumeControl({ volume, onChange }: { volume: number; onChange: (v: number) => void }) {
  return (
    <input
      type="range"
      min={0}
      max={1}
      step={0.05}
      value={volume}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label="Volume"
      className="h-1 w-16 shrink-0 accent-accent"
    />
  );
}

function PlayIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M3 1.5v13l11-6.5z" />
    </svg>
  );
}

function PauseIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="3" y="1.5" width="3.5" height="13" />
      <rect x="9.5" y="1.5" width="3.5" height="13" />
    </svg>
  );
}

function SkipBackIcon() {
  return (
    <svg width={13} height={11} viewBox="0 0 16 14" fill="currentColor" aria-hidden>
      <path d="M8 0v3.2A6 6 0 1014 9.2h-1.6A4.4 4.4 0 118 4.8V8l4-4z" />
    </svg>
  );
}

function SkipForwardIcon() {
  return (
    <svg
      width={13}
      height={11}
      viewBox="0 0 16 14"
      fill="currentColor"
      style={{ transform: "scaleX(-1)" }}
      aria-hidden
    >
      <path d="M8 0v3.2A6 6 0 1014 9.2h-1.6A4.4 4.4 0 118 4.8V8l4-4z" />
    </svg>
  );
}
