"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CLIP_SECONDS } from "@/src/core/preview";
import { OpenInLinks } from "@/src/features/library/OpenInLinks";
import { player, usePlayerState } from "@/src/state/player";
import { CoverTile } from "@/src/ui";

/**
 * App-wide 30-second preview bar, mounted once in the root layout.
 * Audio streams straight from the podcast's public CDN into an <audio>
 * element (only metadata goes through /api/*). When a clip can't play,
 * the bar keeps the "listen in full" platform links — never a dead end.
 */
export function PreviewPlayer() {
  const s = usePlayerState();
  const audioRef = useRef<HTMLAudioElement>(null);
  // intended seek target; the ACTUAL clip origin is captured once playback
  // settles so the 30s window is correct even when the CDN can't seek.
  const targetRef = useRef(0);
  const seekRequestedRef = useRef(false);
  const decidedRef = useRef(false);
  const originRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [fromStart, setFromStart] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setProgress(0);
    setFromStart(false);
    targetRef.current = s.startAt;
    seekRequestedRef.current = false;
    decidedRef.current = false;
    originRef.current = null;

    if (s.status !== "playing" || !s.audioUrl) {
      audio.pause();
      audio.removeAttribute("src");
      return;
    }

    let cancelled = false;
    let fallback: ReturnType<typeof setTimeout> | undefined;
    audio.src = s.audioUrl;

    // Anchor the 30s window to the real playback position, whatever it
    // turns out to be — the requested offset on a Range-capable CDN, or 0
    // when the CDN can't seek. Set exactly once.
    const anchor = (at: number) => {
      if (cancelled || originRef.current !== null) return;
      originRef.current = at;
      if (targetRef.current - at > 5) setFromStart(true);
    };

    const onLoaded = () => {
      if (cancelled) return;
      // clamp the target against the real duration only when the browser
      // knows it — an unknown (NaN) duration must not collapse it to 0.
      // A startFraction ("random middle") resolves against the true length
      // and wins over the seconds fallback whenever the duration is known.
      const known = Number.isFinite(audio.duration) && audio.duration > 0;
      const base =
        known && s.startFraction != null ? audio.duration * s.startFraction : s.startAt;
      targetRef.current = known
        ? Math.min(base, Math.max(0, audio.duration - CLIP_SECONDS))
        : s.startAt;
      seekRequestedRef.current = targetRef.current > 0.5;
      if (seekRequestedRef.current) {
        // best-effort seek; anchored by onSeeked once it settles
        try {
          audio.currentTime = targetRef.current;
        } catch {
          seekRequestedRef.current = false;
        }
      }
      // the seek is now classified — onTime may anchor from here on
      decidedRef.current = true;
      audio.play().catch(() => {
        if (!cancelled) player.fail();
      });
      // safety net: if 'seeked' never fires (some non-seekable streams),
      // anchor to wherever we are after a moment
      fallback = setTimeout(() => anchor(audio.currentTime), 3000);
    };
    // when a seek was requested, THIS is the trusted origin — waiting for
    // it avoids the pre-seek `timeupdate` at 0 that would end the clip early
    const onSeeked = () => {
      if (seekRequestedRef.current) anchor(audio.currentTime);
    };
    const onTime = () => {
      if (cancelled || !decidedRef.current) return; // wait for onLoaded
      // no seek requested -> first playback position is the origin;
      // seek requested -> hold until onSeeked/fallback anchors it
      if (originRef.current === null) {
        if (!seekRequestedRef.current) anchor(audio.currentTime);
        else return;
      }
      const elapsed = audio.currentTime - originRef.current!;
      setProgress(Math.min(Math.max(elapsed / CLIP_SECONDS, 0), 1));
      if (elapsed >= CLIP_SECONDS) {
        audio.pause();
        player.finish();
      }
    };
    const onEnded = () => !cancelled && player.finish();
    const onError = () => !cancelled && player.fail();

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("seeked", onSeeked);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.load();

    return () => {
      cancelled = true;
      if (fallback) clearTimeout(fallback);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("seeked", onSeeked);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.pause();
    };
    // token bumps on every play request, even for the same URL
  }, [s.token, s.status, s.audioUrl, s.startAt, s.startFraction]);

  const statusLine =
    s.status === "loading"
      ? "Finding a clip…"
      : s.status === "error"
        ? "Preview unavailable — listen in full below"
        : s.status === "done"
          ? "Clip finished — like it? Listen in full:"
          : s.status === "playing" && fromStart
            ? "30s preview from the start"
            : s.meta?.showTitle;

  return (
    <>
      <audio ref={audioRef} preload="none" />
      <AnimatePresence>
        {s.status !== "idle" && s.meta && (
          <motion.div
            initial={{ y: 96, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            // Liquid-glass Play bar: translucent + blurred so content shows
            // through, with a hairline border for edge definition. z-45 sits
            // above the tab bar (z-40) but strictly below the floating
            // Search bar (z-50) in the stack.
            className="fixed inset-x-0 bottom-16 z-[45] border-t border-white/30 bg-white/30 backdrop-blur-md dark:border-white/10 dark:bg-black/30"
          >
            <div className="mx-auto flex max-w-2xl flex-col gap-2 p-3 sm:px-8">
              <div className="flex items-center gap-3">
                {/* Cover + text route to the show's page when we know its id */}
                {s.meta.showId ? (
                  <Link
                    href={`/show/${s.meta.showId}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <CoverTile src={s.meta.coverUrl} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold hover:underline">{s.meta.title}</p>
                      <p className="truncate text-xs text-zinc-500">{statusLine}</p>
                    </div>
                  </Link>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <CoverTile src={s.meta.coverUrl} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{s.meta.title}</p>
                      <p className="truncate text-xs text-zinc-500">{statusLine}</p>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => player.dismiss()}
                  aria-label="Close preview"
                  className="shrink-0 rounded-full px-2 py-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                >
                  ✕
                </button>
              </div>

              {(s.status === "playing" || s.status === "done") && (
                <div className="h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-zinc-900 transition-[width] duration-300 dark:bg-zinc-100"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              )}

              {/* Icons only — no text labels — per the Play-bar spec. */}
              <div className="flex items-center gap-2">
                <span className="font-brand shrink-0 text-[10px] uppercase tracking-wider text-zinc-400">
                  Listen in full
                </span>
                <OpenInLinks
                  title={s.meta.searchTitle}
                  appleUrl={s.meta.appleUrl}
                  feedUrl={s.meta.feedUrl}
                  stored={s.meta.platformLinks}
                  label=""
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
