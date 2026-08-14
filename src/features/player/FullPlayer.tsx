"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatTime } from "@/src/core/player/playerMath";
import { usePlayerState } from "@/src/state/player";
import { fullPlayer, useFullPlayerState } from "@/src/state/fullPlayer";
import { CoverTile, NothingToggle } from "@/src/ui";
import { springs } from "@/src/ui/tokens";
import { PlayerWaveformScrubber } from "./PlayerWaveformScrubber";
import { useFullPlayback } from "./useFullPlayback";

const SKIP_BACK_SEC = 15;
const SKIP_FORWARD_SEC = 30;
const SLEEP_PRESETS_MIN = [5, 15, 30, 45, 60];

/**
 * Real in-app playback — Aaron's own ask (2026-08-14): "tired of keep
 * going to other podcast player and come back, and they are not fully
 * synced." Separate from PreviewPlayer's 30s snippet bar; opened from a
 * saved episode in the Library (see EpisodeCard.tsx). Deliberately scoped
 * to playback + the pixel waveform + speed/timer controls — promo-skip
 * and voice enhancement are explicitly out for this first cut (note I,
 * feedback-wavefm.md).
 *
 * Mini bar collapsed, tap to expand to the full scrub/controls view —
 * same two-level shape as any real podcast player (Overcast, Apple
 * Podcasts).
 */
export function FullPlayer() {
  const s = useFullPlayerState();
  const previewState = usePlayerState();
  const audioRef = useRef<HTMLAudioElement>(null);
  const { currentTime, duration, seek } = useFullPlayback(audioRef);
  const [sleepMenuOpen, setSleepMenuOpen] = useState(false);
  // Minutes-remaining display for the sleep timer. Reading Date.now()
  // directly in render trips react-hooks/purity (the same rule
  // ListenInsights hit) — ticking it from an effect's own interval is the
  // sanctioned way to surface a live clock-derived value.
  const [sleepRemainingMin, setSleepRemainingMin] = useState<number | null>(null);
  useEffect(() => {
    const endsAt = s.sleepTimerEndsAt;
    if (endsAt == null) return;
    // setState only ever fires from inside the interval callback, never
    // synchronously in the effect body — a first tick doesn't fire until
    // 1s in, so the button briefly shows a placeholder rather than a
    // number right when the timer starts (see render below).
    const id = setInterval(() => {
      setSleepRemainingMin(Math.max(0, Math.ceil((endsAt - Date.now()) / 60_000)));
    }, 1000);
    return () => clearInterval(id);
  }, [s.sleepTimerEndsAt]);

  // A preview clip starting elsewhere takes over the one audio channel a
  // person actually has — pause full playback rather than let both race.
  useEffect(() => {
    if (previewState.status !== "idle" && s.status === "playing") fullPlayer.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewState.status]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && s.expanded) fullPlayer.setExpanded(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [s.expanded]);

  useEffect(() => {
    if (!s.expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [s.expanded]);

  if (!s.meta) return <audio ref={audioRef} preload="none" />;

  const meta = s.meta;
  const playing = s.status === "playing";

  return (
    <>
      <audio ref={audioRef} preload="none" />
      <AnimatePresence>
        {!s.expanded && (
          <motion.div
            initial={{ y: 96, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 96, opacity: 0 }}
            transition={springs.press}
            onClick={() => fullPlayer.setExpanded(true)}
            role="button"
            tabIndex={0}
            // Same layer as PreviewPlayer's bar — only one of the two is
            // ever rendered at a time (mutual pause above), so they never
            // actually stack, but they share the slot either way.
            className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-[45] cursor-pointer border-t border-white/30 bg-white/30 backdrop-blur-md dark:border-white/10 dark:bg-black/30"
          >
            <div className="mx-auto flex max-w-2xl items-center gap-3 p-3 sm:px-8">
              <CoverTile src={meta.coverUrl} size={44} className="!rounded-2xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{meta.title}</p>
                <p className="truncate text-xs text-zinc-500">{meta.showTitle ?? formatTime(currentTime)}</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fullPlayer.toggle();
                }}
                aria-label={playing ? "Pause" : "Play"}
                className="nothing-circle h-10 w-10 shrink-0"
              >
                {playing ? <PauseIcon /> : <PlayIcon />}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fullPlayer.close();
                }}
                aria-label="Close player"
                className="shrink-0 rounded-full px-2 py-1 text-muted-foreground hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {s.expanded && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={springs.settle}
            className="fixed inset-0 z-[60] flex flex-col bg-background"
          >
            <div className="flex items-center justify-between px-4 py-3 sm:px-8">
              <button
                type="button"
                onClick={() => fullPlayer.setExpanded(false)}
                className="font-brand text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                Minimize
              </button>
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
              <CoverTile src={meta.coverUrl} size={220} className="!rounded-[2rem] shadow-lg" />

              <div className="w-full text-center">
                {meta.showId ? (
                  <Link
                    href={`/show/${meta.showId}`}
                    className="font-brand line-clamp-1 text-sm font-bold uppercase tracking-wide text-accent hover:underline"
                  >
                    {meta.showTitle}
                  </Link>
                ) : (
                  meta.showTitle && (
                    <p className="font-brand line-clamp-1 text-sm font-bold uppercase tracking-wide text-accent">
                      {meta.showTitle}
                    </p>
                  )
                )}
                <p className="mt-1 line-clamp-2 text-lg font-semibold leading-snug">{meta.title}</p>
              </div>

              <div className="w-full">
                <PlayerWaveformScrubber
                  active={playing}
                  currentTime={currentTime}
                  duration={duration}
                  onSeek={seek}
                />
              </div>

              <div className="flex items-center justify-center gap-6">
                <button
                  type="button"
                  onClick={() => seek(currentTime - SKIP_BACK_SEC)}
                  aria-label={`Back ${SKIP_BACK_SEC} seconds`}
                  className="nothing-circle flex h-12 w-12 flex-col items-center justify-center gap-0.5 text-xs font-bold"
                >
                  <SkipBackIcon />
                  {SKIP_BACK_SEC}
                </button>
                <button
                  type="button"
                  onClick={() => fullPlayer.toggle()}
                  aria-label={playing ? "Pause" : "Play"}
                  className="nothing-circle flex h-16 w-16 items-center justify-center"
                >
                  {playing ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
                </button>
                <button
                  type="button"
                  onClick={() => seek(currentTime + SKIP_FORWARD_SEC)}
                  aria-label={`Forward ${SKIP_FORWARD_SEC} seconds`}
                  className="nothing-circle flex h-12 w-12 flex-col items-center justify-center gap-0.5 text-xs font-bold"
                >
                  <SkipForwardIcon />
                  {SKIP_FORWARD_SEC}
                </button>
              </div>

              <div className="flex w-full items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fullPlayer.cycleSpeed()}
                  aria-label="Playback speed"
                  className="font-brand rounded-full border border-surface-border px-3 py-1.5 text-xs font-bold tabular-nums hover:border-accent hover:text-accent"
                >
                  {s.playbackRate}×
                </button>
                <div className="relative">
                  <NothingToggle
                    active={s.sleepTimerEndsAt != null}
                    onClick={() => setSleepMenuOpen((v) => !v)}
                    ariaLabel="Sleep timer"
                    className="!rounded-full"
                  >
                    {s.sleepTimerEndsAt != null ? `${sleepRemainingMin ?? "…"}m` : "Timer"}
                  </NothingToggle>
                  {sleepMenuOpen && (
                    <div className="glass-panel absolute bottom-full left-1/2 mb-2 w-32 -translate-x-1/2 rounded-card p-1.5 shadow-lg">
                      {SLEEP_PRESETS_MIN.map((min) => (
                        <button
                          key={min}
                          type="button"
                          onClick={() => {
                            fullPlayer.setSleepTimer(min);
                            setSleepMenuOpen(false);
                          }}
                          className="block w-full rounded-[2px] px-2 py-1 text-left text-xs hover:bg-accent-soft hover:text-accent"
                        >
                          {min} min
                        </button>
                      ))}
                      {s.sleepTimerEndsAt != null && (
                        <button
                          type="button"
                          onClick={() => {
                            fullPlayer.setSleepTimer(null);
                            setSleepMenuOpen(false);
                          }}
                          className="block w-full rounded-[2px] px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent-soft hover:text-accent"
                        >
                          Turn off
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function PlayIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M3 1.5v13l11-6.5z" />
    </svg>
  );
}

function PauseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="3" y="1.5" width="3.5" height="13" />
      <rect x="9.5" y="1.5" width="3.5" height="13" />
    </svg>
  );
}

function SkipBackIcon() {
  return (
    <svg width={16} height={14} viewBox="0 0 16 14" fill="currentColor" aria-hidden>
      <path d="M8 0v3.2A6 6 0 1014 9.2h-1.6A4.4 4.4 0 118 4.8V8l4-4z" />
    </svg>
  );
}

function SkipForwardIcon() {
  return (
    <svg
      width={16}
      height={14}
      viewBox="0 0 16 14"
      fill="currentColor"
      style={{ transform: "scaleX(-1)" }}
      aria-hidden
    >
      <path d="M8 0v3.2A6 6 0 1014 9.2h-1.6A4.4 4.4 0 118 4.8V8l4-4z" />
    </svg>
  );
}
