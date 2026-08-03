"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { middleFraction } from "@/src/core/preview";
import { getRankedEpisodes } from "@/src/data/catalog/client";
import { trackEvent } from "@/src/data/repos/analyticsRepo";
import {
  isEpisodeSaved,
  removeEpisode,
  saveEpisode,
  updateEpisodeProgress,
} from "@/src/data/repos/savedEpisodesRepo";
import { OpenInLinks } from "@/src/features/library/OpenInLinks";
import { player, usePlayerState, type PreviewMeta } from "@/src/state/player";
import { CoverTile, NothingToggle } from "@/src/ui";
import { SiriWaveform } from "./SiriWaveform";
import { useClipWindow } from "./useClipWindow";

/**
 * App-wide 30-second preview bar, mounted once in the root layout.
 * Audio streams straight from the podcast's public CDN into an <audio>
 * element (only metadata goes through /api/*). When a clip can't play,
 * the bar falls back to the "listen in full" platform links — never a
 * dead end — but while a clip is actually live it surfaces Save plus
 * prev/next through the show's other episodes instead.
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

  // The show's own episode list (RSS-derived, same source as the rest of
  // the app's ranking — no extra external calls) doubles as the prev/next
  // queue and gives episodes a stable id even when the clip started from a
  // random pick that didn't carry one.
  const showId = s.meta?.showId;
  const episodeListQ = useQuery({
    queryKey: ["catalog", "episodes-ranked", showId],
    queryFn: () => getRankedEpisodes(showId ?? ""),
    enabled: Boolean(showId) && s.status !== "idle",
    staleTime: 60 * 60 * 1000,
  });
  const list = episodeListQ.data ?? [];
  const currentIndex = list.findIndex((e) =>
    s.meta?.episodeId ? e.id === s.meta.episodeId : e.title === s.meta?.title,
  );

  function findPlayable(from: number, dir: 1 | -1): number {
    for (let i = from; i >= 0 && i < list.length; i += dir) {
      if (list[i].audioUrl) return i;
    }
    return -1;
  }
  const prevIndex = currentIndex > 0 ? findPlayable(currentIndex - 1, -1) : -1;
  const nextIndex =
    currentIndex === -1 ? findPlayable(0, 1) : findPlayable(currentIndex + 1, 1);

  function playListIndex(idx: number) {
    if (!s.meta || idx < 0 || idx >= list.length) return;
    const item = list[idx];
    if (!item.audioUrl) return;
    const meta: PreviewMeta = { ...s.meta, title: item.title, searchTitle: item.title, episodeId: item.id };
    const fraction = middleFraction(Math.random());
    const startAt = item.durationSec ? Math.floor(item.durationSec * fraction) : 0;
    player.play(meta, item.audioUrl, startAt, fraction);
  }

  // Save toggle — needs a stable episode id, which not every clip carries
  // (a random show-level pick may not resolve against the ranked list).
  const effectiveEpisodeId = s.meta?.episodeId ?? (currentIndex >= 0 ? list[currentIndex].id : undefined);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    // No stable id -> the toggle stays hidden (see render below), so
    // there's nothing to synchronize; leave prior state untouched rather
    // than setState-on-mount for a value nobody will see.
    if (!effectiveEpisodeId) return;
    let cancelled = false;
    void isEpisodeSaved(effectiveEpisodeId).then((v) => {
      if (!cancelled) setSaved(v);
    });
    return () => {
      cancelled = true;
    };
  }, [effectiveEpisodeId]);

  // Auto-track listen progress from what's actually played (REFINEMENTS.md
  // #12), not just the manual "Done?" toggle. The clip anchors to the real
  // media-element timeline (see useClipWindow's `origin` bookkeeping), so
  // `audioRef.current.currentTime` already IS the true position in the
  // full episode — no clip-relative math needed. Only meaningful for a
  // saved episode; updateEpisodeProgress is a silent no-op otherwise.
  const wasPlayingRef = useRef(false);
  useEffect(() => {
    if (s.status === "playing" && !wasPlayingRef.current) {
      // Every preview play, saved or not — the other half of the preview→open
      // funnel (REFINEMENTS.md #29); recordEngagement's "open" leg is the
      // deliberate full-episode opens, this is "did they even try the clip".
      if (s.meta?.showId) trackEvent("preview_played", s.meta.showId);
      if (saved && effectiveEpisodeId) {
        void updateEpisodeProgress(effectiveEpisodeId, { status: "in_progress" });
      }
    }
    wasPlayingRef.current = s.status === "playing";
  }, [s.status, saved, effectiveEpisodeId, s.meta?.showId]);

  useEffect(() => {
    // The <audio> element is mounted once, unconditionally, for the app's
    // lifetime — capturing the node (not re-reading audioRef.current) at
    // cleanup time is just satisfying the lint rule, not a real ref-churn
    // risk here.
    const audio = audioRef.current;
    return () => {
      if (saved && effectiveEpisodeId && wasPlayingRef.current) {
        const positionSec = Math.floor(audio?.currentTime ?? 0);
        if (positionSec > 0) void updateEpisodeProgress(effectiveEpisodeId, { positionSec });
      }
    };
  }, [s.status, saved, effectiveEpisodeId]);

  function toggleSave() {
    if (!effectiveEpisodeId || !s.meta) return;
    const next = !saved;
    setSaved(next);
    if (next) {
      const durationSec = currentIndex >= 0 ? list[currentIndex].durationSec : undefined;
      void saveEpisode({
        id: effectiveEpisodeId,
        title: s.meta.title,
        showId: s.meta.showId,
        showTitle: s.meta.showTitle,
        coverUrl: s.meta.coverUrl,
        appleUrl: s.meta.appleUrl,
        audioUrl: s.audioUrl ?? undefined,
        durationSec,
        categories: [],
      });
    } else {
      void removeEpisode(effectiveEpisodeId);
    }
  }

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
                <SiriWaveform active={s.status === "playing"} progress={progress} />
              )}

              {/* While a clip is live: skip to another episode of this show,
                  plus a one-click Save. Once it's done or blocked, fall back
                  to the platform deep-links so the bar never dead-ends. */}
              {s.status === "playing" || s.status === "loading" ? (
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => playListIndex(prevIndex)}
                    disabled={prevIndex === -1}
                    aria-label="Previous episode"
                    title="Previous episode"
                    className="nothing-circle h-8 w-8 shrink-0"
                  >
                    <SkipIcon direction="prev" className="h-3.5 w-3.5" />
                  </button>
                  {effectiveEpisodeId && (
                    <NothingToggle
                      active={saved}
                      onClick={toggleSave}
                      ariaLabel={saved ? "Saved ✓" : "Save episode"}
                      className="shrink-0"
                    >
                      {saved ? "✓" : "+"}
                    </NothingToggle>
                  )}
                  <button
                    type="button"
                    onClick={() => playListIndex(nextIndex)}
                    disabled={nextIndex === -1}
                    aria-label="Next episode"
                    title="Next episode"
                    className="nothing-circle h-8 w-8 shrink-0"
                  >
                    <SkipIcon direction="next" className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <OpenInLinks
                  title={s.meta.searchTitle}
                  appleUrl={s.meta.appleUrl}
                  feedUrl={s.meta.feedUrl}
                  stored={s.meta.platformLinks}
                  showId={s.meta.showId}
                  label=""
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Double-triangle skip glyph, mirroring the single-triangle PlayButton. */
function SkipIcon({ direction, className }: { direction: "prev" | "next"; className?: string }) {
  return (
    <svg
      width={14}
      height={12}
      viewBox="0 0 14 12"
      fill="currentColor"
      className={className}
      style={direction === "prev" ? { transform: "scaleX(-1)" } : undefined}
      aria-hidden
    >
      <path d="M0 0l6 6-6 6z" />
      <path d="M7 0l6 6-6 6z" />
    </svg>
  );
}
