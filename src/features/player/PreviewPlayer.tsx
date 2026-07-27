"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useRef } from "react";
import { OpenInLinks } from "@/src/features/library/OpenInLinks";
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
