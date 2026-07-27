"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useRef } from "react";
import { platformLinks } from "@/src/core/links";
import { player, usePlayerState } from "@/src/state/player";
import { CoverTile } from "@/src/ui";
import { useClipWindow } from "./useClipWindow";

/**
 * App-wide 30-second preview bar, mounted once in the root layout.
 * Audio streams straight from the podcast's public CDN into an <audio>
 * element (only metadata goes through /api/*). When a clip can't play,
 * the bar keeps the "listen in full" platform links — never a dead end.
 */
export function PreviewPlayer() {
  const s = usePlayerState();
  const audioRef = useRef<HTMLAudioElement>(null);

  const onFinish = useCallback(() => player.finish(), []);
  const onError = useCallback(() => player.fail(), []);

  const { progress, fromStart } = useClipWindow(
    audioRef,
    s.status === "playing" && s.audioUrl
      ? {
          audioUrl: s.audioUrl,
          startAt: s.startAt,
          startFraction: s.startFraction,
          token: s.token,
        }
      : null,
    { onFinish, onError },
  );

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
            className="fixed inset-x-0 bottom-16 z-50 border-t border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95"
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
