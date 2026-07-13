"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { platformLinks } from "@/src/core/links";
import { CLIP_SECONDS } from "@/src/core/preview";
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
  const clipStartRef = useRef(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setProgress(0);

    if (s.status !== "playing" || !s.audioUrl) {
      audio.pause();
      audio.removeAttribute("src");
      return;
    }

    let cancelled = false;
    clipStartRef.current = s.startAt;
    audio.src = s.audioUrl;

    const onLoaded = () => {
      if (cancelled) return;
      // clamp against the real duration only when the browser knows it —
      // an unknown (NaN) duration must not collapse the random start to 0
      const known = Number.isFinite(audio.duration) && audio.duration > 0;
      clipStartRef.current = known
        ? Math.min(s.startAt, Math.max(0, audio.duration - CLIP_SECONDS))
        : s.startAt;
      try {
        audio.currentTime = clipStartRef.current;
        // the seek may land short (browser clamps to the seekable range)
        clipStartRef.current = Math.min(clipStartRef.current, audio.currentTime);
      } catch {
        clipStartRef.current = 0;
      }
      audio.play().catch(() => {
        if (!cancelled) player.fail();
      });
    };
    const onTime = () => {
      if (cancelled) return;
      const elapsed = audio.currentTime - clipStartRef.current;
      setProgress(Math.min(Math.max(elapsed / CLIP_SECONDS, 0), 1));
      if (elapsed >= CLIP_SECONDS) {
        audio.pause();
        player.finish();
      }
    };
    const onEnded = () => !cancelled && player.finish();
    const onError = () => !cancelled && player.fail();

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.load();

    return () => {
      cancelled = true;
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.pause();
    };
    // token bumps on every play request, even for the same URL
  }, [s.token, s.status, s.audioUrl, s.startAt]);

  const links = s.meta
    ? platformLinks(s.meta.searchTitle, { apple: s.meta.appleUrl })
    : [];

  const statusLine =
    s.status === "loading"
      ? "Finding a clip…"
      : s.status === "error"
        ? "Preview unavailable — listen in full below"
        : s.status === "done"
          ? "Clip finished — like it? Listen in full:"
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
            className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95"
          >
            <div className="mx-auto flex max-w-2xl flex-col gap-2 p-3 sm:px-8">
              <div className="flex items-center gap-3">
                <CoverTile src={s.meta.coverUrl} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {s.status === "playing" && "▶ "}
                    {s.meta.title}
                  </p>
                  <p className="truncate text-xs text-zinc-500">{statusLine}</p>
                </div>
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

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-zinc-400">Listen in full:</span>
                {links.map((link) =>
                  link.url ? (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-pill bg-surface px-2.5 py-1 text-xs font-medium hover:opacity-80"
                    >
                      {link.label}
                      {link.isSearch ? " ↗" : ""}
                    </a>
                  ) : (
                    <span
                      key={link.id}
                      aria-disabled
                      className="cursor-not-allowed rounded-pill bg-surface px-2.5 py-1 text-xs font-medium opacity-40"
                    >
                      {link.label}
                    </span>
                  ),
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
