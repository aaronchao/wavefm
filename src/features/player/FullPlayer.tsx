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
import { CastButton } from "./CastButton";
import { FullscreenSeekDial } from "./FullscreenSeekDial";
import { PlayerWaveformScrubber } from "./PlayerWaveformScrubber";
import { TwoDialPicker } from "./TwoDialPicker";
import { useFullPlayback } from "./useFullPlayback";
import { useHoldSeek } from "./useHoldSeek";
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
 * 2026-08-16, second redesign pass: tapping the mini widget now expands
 * it to a fullscreen player — same layout language, bigger, plus speed
 * and sleep-timer controls that used to only live inside the rotary
 * dial page. The rotary dial (long-hold the left circle) and the seek
 * dial (long-hold the waveform, useHoldSeek.ts) are two genuinely
 * separate triggers now — they used to share the same gesture, which
 * meant using one made the other unreachable.
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
  const [expanded, setExpanded] = useState(false);

  function cycleSleepTimer() {
    const remaining = s.sleepTimerEndsAt == null ? null : Math.ceil((s.sleepTimerEndsAt - Date.now()) / 60_000);
    const idx = remaining == null ? -1 : SLEEP_CYCLE_MIN.findIndex((m) => m != null && Math.abs(m - remaining) <= 2);
    const next = SLEEP_CYCLE_MIN[(idx + 2) % SLEEP_CYCLE_MIN.length];
    fullPlayer.setSleepTimer(next);
  }

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
  const holdSeek = useHoldSeek(currentTime, duration, (sec) => seek(sec));

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
    if (!rotary.active && !holdSeek.active && !expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [rotary.active, holdSeek.active, expanded]);

  if (!s.meta) return <audio ref={audioRef} preload="none" />;

  const meta = s.meta;
  const playing = s.status === "playing";
  const originT =
    s.openOriginRect && typeof window !== "undefined"
      ? originTransform(s.openOriginRect, window.innerWidth, window.innerHeight)
      : null;
  const sleepLabel = s.sleepTimerEndsAt != null ? `${sleepRemainingMin ?? "…"}m` : "Timer";

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
        style={{ transformOrigin: "center", visibility: expanded ? "hidden" : "visible" }}
        className="fixed inset-x-3 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.5rem)] z-[45] overflow-hidden border border-white/30 bg-white/40 backdrop-blur-md dark:border-white/10 dark:bg-black/50 sm:inset-x-8"
      >
        <div className="mx-auto flex max-w-2xl cursor-pointer flex-col gap-2 p-3" onClick={() => setExpanded(true)}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              aria-label="Expand player"
              className="min-w-0 flex-1 text-left"
            >
              <p className="truncate text-sm font-semibold">{meta.title}</p>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{meta.showTitle}</p>
            </button>
            <VolumeControl volume={volume} onChange={setVolume} />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fullPlayer.close();
              }}
              aria-label="Close player"
              className="shrink-0 rounded-full px-1.5 py-1 text-muted-foreground hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              ✕
            </button>
          </div>

          <PlayerControlsRow
            queueLabel={queue.length > 0 ? `${currentIndex + 1}` : "–"}
            queueTotal={queue.length || "–"}
            rotaryHandlers={rotary.handlers}
            playing={playing}
            saved={saved}
            displaySec={holdSeek.dragging ? holdSeek.previewSec : currentTime}
            dragging={holdSeek.dragging}
            duration={duration}
            holdSeekHandlers={holdSeek.handlers}
            onToggleSaved={toggleSaved}
            onTogglePlay={() => fullPlayer.toggle()}
            onSkipBack={() => seek(currentTime - SKIP_BACK_SEC)}
            onSkipForward={() => seek(currentTime + SKIP_FORWARD_SEC)}
          />
        </div>
      </motion.div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={springs.settle}
            className="fixed inset-0 z-[55] flex flex-col bg-background"
          >
            <div className="flex items-center justify-between px-4 py-3 sm:px-8">
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="font-brand text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                Minimize
              </button>
              <CastButton audioUrl={meta.audioUrl} title={meta.title} />
              <button
                type="button"
                onClick={() => fullPlayer.close()}
                aria-label="Close player"
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-6 pb-16">
              <div className="w-full text-center">
                <p className="font-brand line-clamp-1 text-sm font-bold uppercase tracking-wide text-accent">
                  {meta.showTitle}
                </p>
                <p className="mt-1 line-clamp-2 text-lg font-semibold leading-snug">{meta.title}</p>
              </div>

              <PlayerControlsRow
                large
                queueLabel={queue.length > 0 ? `${currentIndex + 1}` : "–"}
                queueTotal={queue.length || "–"}
                rotaryHandlers={rotary.handlers}
                playing={playing}
                saved={saved}
                displaySec={holdSeek.dragging ? holdSeek.previewSec : currentTime}
                dragging={holdSeek.dragging}
                duration={duration}
                holdSeekHandlers={holdSeek.handlers}
                onToggleSaved={toggleSaved}
                onTogglePlay={() => fullPlayer.toggle()}
                onSkipBack={() => seek(currentTime - SKIP_BACK_SEC)}
                onSkipForward={() => seek(currentTime + SKIP_FORWARD_SEC)}
              />

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fullPlayer.cycleSpeed()}
                  className="font-brand rounded-full border border-surface-border px-3 py-1.5 text-xs font-bold tabular-nums hover:border-accent hover:text-accent"
                >
                  {s.playbackRate}×
                </button>
                <button
                  type="button"
                  onClick={cycleSleepTimer}
                  className="font-brand rounded-full border border-surface-border px-3 py-1.5 text-xs font-bold tabular-nums hover:border-accent hover:text-accent"
                >
                  {sleepLabel}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {rotary.active && (
          <TwoDialPicker
            list={queue}
            index={rotary.index}
            playbackRate={s.playbackRate}
            onCycleSpeed={() => fullPlayer.cycleSpeed()}
            onOpenPlaylist={() => setPlaylistOpen(true)}
            sleepLabel={sleepLabel}
            onCycleSleep={cycleSleepTimer}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {holdSeek.active && (
          <FullscreenSeekDial previewSec={holdSeek.previewSec} duration={duration} fine={holdSeek.fine} />
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

type PointerHandlers = {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
};

/**
 * The dial circle + waveform + 2x2 icon grid row — shared between the
 * mini widget and the fullscreen player so the two stay visually
 * consistent (Aaron's ask: fullscreen "in the same principle as the
 * mini player"), just bigger when `large`.
 */
function PlayerControlsRow({
  large,
  queueLabel,
  queueTotal,
  rotaryHandlers,
  playing,
  saved,
  displaySec,
  dragging,
  duration,
  holdSeekHandlers,
  onToggleSaved,
  onTogglePlay,
  onSkipBack,
  onSkipForward,
}: {
  large?: boolean;
  queueLabel: string;
  queueTotal: string | number;
  rotaryHandlers: PointerHandlers;
  playing: boolean;
  saved: boolean;
  displaySec: number;
  dragging: boolean;
  duration: number;
  holdSeekHandlers: PointerHandlers;
  onToggleSaved: () => void;
  onTogglePlay: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
}) {
  const dialSize = large ? "h-24 w-24" : "h-16 w-16";
  const iconSize = large ? "h-14 w-14" : "h-11 w-11";
  const iconGlyph = large ? 20 : 16;

  return (
    <div className="flex w-full items-center gap-3" onClick={(e) => e.stopPropagation()}>
      <div
        {...rotaryHandlers}
        role="button"
        aria-label="Hold to choose a different saved episode"
        tabIndex={0}
        className={`nothing-circle flex shrink-0 touch-none select-none flex-col items-center justify-center ${dialSize}`}
      >
        <span className={`font-brand font-black leading-none tabular-nums ${large ? "text-2xl" : "text-base"}`}>
          {queueLabel}
        </span>
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">of {queueTotal}</span>
      </div>

      <div
        {...holdSeekHandlers}
        role="button"
        aria-label="Drag to seek, hold still to open the precise seek dial"
        tabIndex={0}
        className="min-w-0 flex-1 touch-none"
      >
        <PlayerWaveformScrubber active={playing} displaySec={displaySec} duration={duration} dragging={dragging} />
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={onSkipBack}
          aria-label={`Back ${SKIP_BACK_SEC} seconds`}
          className={`nothing-circle flex items-center justify-center ${iconSize}`}
        >
          <SkipBackIcon size={iconGlyph} />
        </button>
        <button
          type="button"
          onClick={onSkipForward}
          aria-label={`Forward ${SKIP_FORWARD_SEC} seconds`}
          className={`nothing-circle flex items-center justify-center ${iconSize}`}
        >
          <SkipForwardIcon size={iconGlyph} />
        </button>
        <button
          type="button"
          onClick={onToggleSaved}
          aria-label={saved ? "Remove from saved" : "Save"}
          data-active={saved}
          className={`nothing-circle flex items-center justify-center font-bold ${iconSize}`}
          style={{ fontSize: iconGlyph }}
        >
          {saved ? "✓" : "+"}
        </button>
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={playing ? "Pause" : "Play"}
          className={`nothing-circle flex items-center justify-center ${iconSize}`}
        >
          {playing ? <PauseIcon size={iconGlyph} /> : <PlayIcon size={iconGlyph} />}
        </button>
      </div>
    </div>
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
      onClick={(e) => e.stopPropagation()}
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

function SkipBackIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 11) / 13} viewBox="0 0 16 14" fill="currentColor" aria-hidden>
      <path d="M8 0v3.2A6 6 0 1014 9.2h-1.6A4.4 4.4 0 118 4.8V8l4-4z" />
    </svg>
  );
}

function SkipForwardIcon({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={(size * 11) / 13}
      viewBox="0 0 16 14"
      fill="currentColor"
      style={{ transform: "scaleX(-1)" }}
      aria-hidden
    >
      <path d="M8 0v3.2A6 6 0 1014 9.2h-1.6A4.4 4.4 0 118 4.8V8l4-4z" />
    </svg>
  );
}
