"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import Link from "next/link";
import type { CSSProperties } from "react";
import { addEpisodeTag, removeEpisodeTag } from "@/src/data/repos/episodeTagsRepo";
import { updateEpisodeProgress, type SavedEpisode } from "@/src/data/repos/savedEpisodesRepo";
import { CoverPlay } from "@/src/features/player/CoverPlay";
import { previewEpisode } from "@/src/features/player/preview";
import { NothingToggle, PlayableCard } from "@/src/ui";
import { springs } from "@/src/ui/tokens";
import { InlineTagInput } from "./InlineTagInput";
import { OpenInLinks } from "./OpenInLinks";

/**
 * The one card used for both Inbox and Queue rows — same layout, same
 * actions (reported that the two looked/behaved differently for no good
 * reason). Dragging moves an Inbox card into the Queue at whatever position
 * it's dropped, or reorders within the Queue; both go through the same
 * `useSortable` wiring (see EpisodesColumn's DndContext) so the drag feel is
 * identical everywhere. The drag handle is a separate element so a plain
 * tap still plays the preview (PlayableCard's own click target).
 */
/** A small, stable 0/70/140ms bucket per id — so jiggling cards start
 *  slightly out of phase with each other, like real Springboard icons,
 *  without needing any shared/random state. */
function jiggleDelayMs(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 3;
  return h * 70;
}

export function EpisodeCard({
  episode,
  tags,
  feedUrl,
  onChanged,
  onTagsChanged,
  onArchive,
  disabled = false,
  jiggle = false,
  snapPulseKey,
}: {
  episode: SavedEpisode;
  tags: string[];
  /** The parent show's feed URL, if known — episodes carry no feed of their own. */
  feedUrl?: string;
  onChanged: () => void;
  onTagsChanged: () => void;
  onArchive: () => void;
  /** True while a tag filter is active — a partial, filtered list can't
   *  safely compute a drop position relative to the true, unfiltered queue. */
  disabled?: boolean;
  /** True on every OTHER card while a drag is in progress — the iOS-
   *  homescreen "we're in reorder mode" wiggle. Never true for the card
   *  actually being dragged (that one lifts into the DragOverlay instead). */
  jiggle?: boolean;
  /** Bumped by the parent every time this card is the one a dragged card
   *  just snapped past/into — triggers a one-shot "magnetic click" ring
   *  pulse. Any change in value (not the value itself) retriggers it. */
  snapPulseKey?: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: episode.episodeId,
    data: { bucket: "queue" as const },
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    // A touch of overshoot instead of dnd-kit's flat default ease — matches
    // the app's spring-driven feel (src/ui/tokens.ts) rather than reading
    // as a generic drag-list widget.
    transition: transition ?? "transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)",
  };

  const finished = episode.status === "finished";
  function toggleFinished() {
    void updateEpisodeProgress(episode.episodeId, {
      status: finished ? "queued" : "finished",
    }).then(onChanged);
  }
  const resume =
    episode.positionSec > 0 && !finished
      ? `resume at ${Math.floor(episode.positionSec / 60)}:${String(episode.positionSec % 60).padStart(2, "0")}`
      : null;
  const statusLabel = finished
    ? "Finished"
    : episode.status === "in_progress"
      ? "In progress"
      : "Saved";

  const play = () =>
    previewEpisode({
      id: episode.episodeId,
      title: episode.title,
      showId: episode.showId,
      showTitle: episode.showTitle,
      coverUrl: episode.coverUrl,
      appleUrl: episode.appleUrl,
      audioUrl: episode.audioUrl,
      durationSec: episode.durationSec,
      categories: [],
    });

  return (
    // Only opacity is Framer-Motion-animated here — dnd-kit already owns
    // `transform` (drag position, and every OTHER item's own slide-over-to-
    // make-room animation via its own useSortable); animating opacity keeps
    // the mount/unmount fade independent instead of the two fighting over
    // the same CSS property.
    <motion.li
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0 }}
      animate={{ opacity: isDragging ? 0.4 : 1 }}
      exit={{ opacity: 0 }}
      transition={springs.settle}
    >
      <PlayableCard
        onPlay={play}
        playLabel={`Preview ${episode.title}`}
        dragHandleProps={disabled ? undefined : { ...attributes, ...listeners }}
        style={jiggle ? ({ "--jiggle-delay": `${jiggleDelayMs(episode.episodeId)}ms` } as CSSProperties) : undefined}
        className={`glass-panel h-32 cursor-pointer overflow-hidden !rounded-[1.75rem] shadow-lg ${finished ? "opacity-60" : ""} ${
          jiggle ? "jiggle" : ""
        }`}
      >
        {/* Remounting on every snapPulseKey change is what replays the CSS
            keyframe — a boolean flag toggled via setState+setTimeout would
            fight React's render cycle for the same one-shot effect. */}
        {snapPulseKey !== undefined && (
          <span
            key={snapPulseKey}
            aria-hidden
            className="snap-pulse pointer-events-none absolute inset-0 rounded-[2px]"
          />
        )}
        {/* Cover + tag column — the tag row lives here, under the cover,
            instead of stacked inline with the title text. */}
        <div className="relative z-10 flex shrink-0 flex-col items-center gap-1">
          <CoverPlay
            src={episode.coverUrl}
            size={72}
            onPlay={play}
            label={`Play a snippet of ${episode.title}`}
            className="!rounded-2xl"
          />
          <InlineTagInput
            tags={tags}
            onAdd={(t) => void addEpisodeTag(episode.episodeId, t).then(onTagsChanged)}
            onRemove={(t) => void removeEpisodeTag(episode.episodeId, t).then(onTagsChanged)}
            className="w-24"
          />
        </div>
        {/* justify-center vertically centers this block against the
            (taller) cover+tag column instead of pinning to the top. */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
          {episode.showId ? (
            <Link
              href={`/show/${episode.showId}`}
              className={`relative z-10 line-clamp-2 font-semibold leading-snug hover:text-accent hover:underline underline-offset-2 ${finished ? "line-through" : ""}`}
            >
              {episode.title}
            </Link>
          ) : (
            <p className={`line-clamp-2 font-semibold leading-snug ${finished ? "line-through" : ""}`}>
              {episode.title}
            </p>
          )}
          {episode.showTitle &&
            (episode.showId ? (
              <Link
                href={`/show/${episode.showId}`}
                className="relative z-10 line-clamp-1 text-sm text-zinc-500 hover:text-accent hover:underline underline-offset-2 dark:text-zinc-400"
              >
                {episode.showTitle} →
              </Link>
            ) : (
              <p className="line-clamp-1 text-sm text-zinc-500 dark:text-zinc-400">{episode.showTitle}</p>
            ))}
          <p className="truncate text-xs text-muted-foreground">
            {statusLabel}
            {resume ? ` · ${resume}` : ""}
            {episode.appleUrl ? "" : " · preview only"}
          </p>
          <OpenInLinks
            title={episode.showTitle ? `${episode.showTitle} ${episode.title}` : episode.title}
            showTitle={episode.showTitle}
            appleUrl={episode.appleUrl}
            audioUrl={episode.audioUrl}
            feedUrl={feedUrl}
            showId={episode.showId}
            className="relative z-10"
          />
        </div>
        <div className="relative z-10 flex shrink-0 flex-col items-center gap-1">
          <NothingToggle
            active={finished}
            onClick={(e) => {
              e.stopPropagation();
              toggleFinished();
            }}
            ariaLabel={finished ? "Mark not finished" : "Mark finished"}
            className="!px-2"
          >
            {finished ? "✓" : "○"}
          </NothingToggle>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onArchive();
            }}
            aria-label={`Archive ${episode.title}`}
            title="Not interested — archive"
            className="rounded-full px-2 py-1 text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>
      </PlayableCard>
    </motion.li>
  );
}

/** Six-dot grip — the universal "drag me" affordance. */
export function GripIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </svg>
  );
}
