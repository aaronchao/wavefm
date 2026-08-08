"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { listEpisodeTags, type EpisodeTagMap } from "@/src/data/repos/episodeTagsRepo";
import { episodesToRetire } from "@/src/core/library/autoRetire";
import { clearHandoff, listHandoffs } from "@/src/data/repos/handoffRepo";
import { logFinished } from "@/src/data/repos/listenHistoryRepo";
import {
  listSavedEpisodes,
  removeEpisode,
  setEpisodeBucket,
  markFinished,
  syncFromGpodder,
  syncFromPocketCasts,
  type SavedEpisode,
} from "@/src/data/repos/savedEpisodesRepo";
import {
  disableSharing,
  getPocketCastsToken,
  setPocketCastsToken,
  enableSharing,
  getFeedToken,
  getShareInfo,
  regenerateFeedToken,
  setShareSlug,
} from "@/src/data/repos/prefsRepo";
import { listSaved } from "@/src/data/repos/savedShowsRepo";
import { rankForIndex } from "@/src/core/queue/rank";
import {
  allTagsFrom,
  listShowTags,
  type ShowTagMap,
} from "@/src/data/repos/showTagsRepo";
import { renameTagEverywhere } from "@/src/data/repos/tagsRepo";
import { BulkYoutubeMusicButton } from "@/src/features/library/BulkYoutubeMusicButton";
import { AccountSync } from "@/src/features/library/AccountSync";
import { CollapsibleSection } from "@/src/features/library/CollapsibleSection";
import { ListenHistory, refreshHistory } from "@/src/features/library/ListenHistory";
import { NewEpisodeWatcher } from "@/src/features/library/NewEpisodeWatcher";
import { ShowGrid } from "@/src/features/library/ShowGrid";
import { EpisodeCard, GripIcon } from "@/src/features/library/EpisodeCard";
import { ExportOpmlButton } from "@/src/features/library/ExportOpmlButton";
import { ImportOpmlButton } from "@/src/features/library/ImportOpmlButton";
import { RightNow } from "@/src/features/library/RightNow";
import { useSession } from "@/src/state/useSession";
import { CoverTile, haptic, LiquidBackdrop, NothingToggle } from "@/src/ui";

/**
 * Library: the collection system, a single 2-column grid — Shows beside
 * Episodes — with a horizontal rail of the user's own tags across the top.
 * Tapping a tag filters both columns at once; each tag chip can also be
 * renamed in place (cascades to every show/episode carrying it). Each card
 * carries its own low-friction inline tag input too, so tagging doesn't
 * require leaving the Library. Everything syncs via Supabase when signed
 * in, localStorage otherwise.
 */
export default function LibraryPage() {
  const { session } = useSession();
  const signedIn = Boolean(session);
  const scope = session?.user.id ?? "local";
  const queryClient = useQueryClient();

  const savedQ = useQuery({ queryKey: ["saved", scope], queryFn: listSaved });
  const episodesQ = useQuery({
    queryKey: ["savedEpisodes", scope],
    queryFn: listSavedEpisodes,
  });
  const showTagsQ = useQuery({ queryKey: ["showTags", scope], queryFn: listShowTags });
  const episodeTagsQ = useQuery({
    queryKey: ["episodeTags", scope],
    queryFn: listEpisodeTags,
  });

  const saved = savedQ.data ?? [];
  // Episodes carry no feed URL of their own (it's their show's) — this is
  // how a queue row's YouTube Music fallback gets the same copy-RSS assist
  // a show card already has.
  const showFeedById = new Map(
    saved.filter((s) => s.show.feedUrl).map((s) => [s.show.id, s.show.feedUrl!]),
  );
  const episodes = episodesQ.data ?? [];
  const showTagMap: ShowTagMap = showTagsQ.data ?? {};
  const episodeTagMap: EpisodeTagMap = episodeTagsQ.data ?? {};
  const allTags = [...new Set([...allTagsFrom(showTagMap), ...allTagsFrom(episodeTagMap)])].sort(
    (a, b) => a.localeCompare(b),
  );

  const invalidateTags = () => {
    void queryClient.invalidateQueries({ queryKey: ["showTags"] });
    void queryClient.invalidateQueries({ queryKey: ["episodeTags"] });
  };

  const [syncOpen, setSyncOpen] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  // a filter for a tag that no longer exists falls back to "All"
  const tag = activeTag && allTags.includes(activeTag) ? activeTag : null;

  const visibleSaved = tag
    ? saved.filter((s) => showTagMap[s.show.id]?.includes(tag))
    : saved;
  // an episode matches on its own tags, or (falling back) its parent show's
  const visibleEpisodes = tag
    ? episodes.filter(
        (e) =>
          episodeTagMap[e.episodeId]?.includes(tag) ||
          (e.showId != null && showTagMap[e.showId]?.includes(tag)),
      )
    : episodes;

  // Reordering needs the TRUE queue order, so it's computed off the
  // unfiltered list and only exposed when no tag filter is narrowing the
  // view (a filtered subset can't say "swap with the next item" meaningfully).
  const fullQueue = [...episodes]
    .filter((e) => e.bucket === "queue")
    .sort((a, b) => (a.queueRank ?? 0) - (b.queueRank ?? 0));

  // `inbox` is retired (see savedEpisodesRepo). New saves go straight to the
  // queue, so this only ever sees rows created before that change — promote
  // them once, on load, rather than stranding them in a bucket nothing
  // renders any more. Guarded by a ref so a refetch can't re-fire it.
  // Auto-retire: an episode handed off to an external player, whose full
  // run time plus a grace margin has since passed, is almost certainly done.
  // Marking it finished drops it out of Right Now and off the "to play" pile
  // without the user having to tell WaveFM something it could infer. Runs
  // once per mount, guarded, and only ever sets `finished` — a status the
  // user can flip back from the card, so a wrong guess costs one tap.
  const retiredRef = useRef(false);
  useEffect(() => {
    if (retiredRef.current || episodes.length === 0) return;
    // `opened_at` on the row is the source of truth now, so a handoff made
    // on another device retires here too. The localStorage map is only a
    // fallback for rows that predate the column (or a signed-out session),
    // and the row always wins where both exist.
    const local = listHandoffs();
    const withHandoff = episodes.map((e) => ({
      ...e,
      openedAt: e.openedAt ?? local[e.episodeId],
    }));
    const due = episodesToRetire(withHandoff, Date.now());
    if (due.length === 0) return;
    retiredRef.current = true;

    void Promise.all(
      due.map((e) =>
        // Recorded as inferred, not asserted — history says "assumed
        // finished", so the guess never masquerades as fact.
        markFinished(e.episodeId, true).then(() => {
          clearHandoff(e.episodeId);
          logFinished(e.episodeId, true);
        }),
      ),
    ).then(() => {
      refreshHistory();
      return queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one pass per mount
  }, [episodes.length]);

  const legacyInbox = episodes.filter((e) => e.bucket === "inbox");
  const promotedRef = useRef(false);
  useEffect(() => {
    if (promotedRef.current || legacyInbox.length === 0) return;
    promotedRef.current = true;
    const ranks = fullQueue.map((e) => e.queueRank ?? 0);
    void Promise.all(
      legacyInbox.map((e, i) =>
        setEpisodeBucket(e.episodeId, "queue", rankForIndex(ranks, fullQueue.length + i)),
      ),
    ).then(() => queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot migration
  }, [legacyInbox.length]);

  const queueEpisodes = tag
    ? visibleEpisodes
        .filter((e) => e.bucket === "queue")
        .sort((a, b) => (a.queueRank ?? 0) - (b.queueRank ?? 0))
    : fullQueue;
  const archivedEpisodes = visibleEpisodes
    .filter((e) => e.bucket === "archived")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  async function renameTag(oldTag: string, newTag: string) {
    if (activeTag === oldTag) setActiveTag(newTag.trim() || null);
    await renameTagEverywhere(oldTag, newTag);
    invalidateTags();
  }

  return (
    <main className="mx-auto w-full max-w-5xl p-4 pb-[calc(14rem+env(safe-area-inset-bottom))] sm:p-8 sm:pb-[calc(14rem+env(safe-area-inset-bottom))]">
      <LiquidBackdrop />
      {/* Background job, renders nothing — pulls new episodes of saved shows
          in. Previously lived inside the shows list, so replacing that list
          would have taken the feature with it. */}
      <NewEpisodeWatcher saved={saved} />
      {/* Saved shows lead, and on a phone they're the only thing above the
          fold. Everything else — the copy, the three sync panels, the tag
          rail, the episode list — used to sit open above them, which is
          screens of text to scroll past before reaching your own content.
          They're all still here, one tap away, just not shouting. */}
      {/* Sync sits top-right rather than as a section at the bottom: it's a
          tool you reach for occasionally and deliberately, not something to
          scroll past. Collapsed by default, and remembers its state. */}
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="font-brand text-2xl font-bold">Library</h1>
        <button
          type="button"
          onClick={() => setSyncOpen((v) => !v)}
          aria-expanded={syncOpen}
          className="font-brand flex shrink-0 items-center gap-1.5 rounded-[2px] border border-surface-border px-3 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
        >
          <SyncIcon className="h-3.5 w-3.5" />
          Sync
        </button>
      </div>

      {syncOpen && (
        <div className="mt-3 flex flex-col gap-3 rounded-[2px] border border-surface-border p-3">
          {/* Account first: everything below only syncs once you're signed in. */}
          <AccountSync />
          <div className="flex flex-wrap items-center gap-2">
            <ImportOpmlButton />
            <ExportOpmlButton />
            <BulkYoutubeMusicButton />
          </div>
          <PocketCastsSyncPanel />
          <FeedSyncPanel signedIn={signedIn} />
          <SharePanel signedIn={signedIn} />
          <GpodderSyncPanel />
        </div>
      )}

      {/* One decision, with the reason for it, before any list — a wall of
          equally-plausible episodes is what stalls the action. */}
      <RightNow episodes={episodes} savedShows={visibleSaved.map((s) => s.show.title)} />

      {/* Open, not collapsed: this is the content, not a tool. */}
      <section className="mt-6">
        <h2 className="font-brand mb-2 flex items-baseline gap-2 py-2 text-xs font-bold uppercase tracking-[0.22em] text-zinc-800 dark:text-zinc-100">
          Saved episodes
          <span className="text-[11px] tracking-[0.2em] text-muted-foreground">
            {visibleEpisodes.length}
          </span>
        </h2>
        <EpisodesColumn
          queue={queueEpisodes}
          archived={archivedEpisodes}
          tagMap={episodeTagMap}
          loading={episodesQ.isLoading}
          filtered={Boolean(tag)}
          onTagsChanged={invalidateTags}
          showFeedById={showFeedById}
        />
      </section>

      {/* The cover grid replaces the old "Tags & show details" section —
          artwork is how shows get recognised, so the metadata list it used
          to sit above was redundant chrome. Tag filtering rides along with
          it, since that's the thing tags are actually for here. */}
      <section className="mt-8">
        <h2 className="font-brand mb-2 flex items-baseline gap-2 py-2 text-xs font-bold uppercase tracking-[0.22em] text-zinc-800 dark:text-zinc-100">
          Your shows
          <span className="text-[11px] tracking-[0.2em] text-muted-foreground">
            {visibleSaved.length}
          </span>
        </h2>
        {allTags.length > 0 && (
          <TagRail tags={allTags} active={tag} onPick={setActiveTag} onRename={renameTag} />
        )}
        <ShowGrid saved={visibleSaved} loading={savedQ.isLoading} filtered={Boolean(tag)} />
      </section>

      <CollapsibleSection id="history" title="Listen history">
        <ListenHistory />
      </CollapsibleSection>

    </main>
  );
}


/**
 * Horizontal, scrollable rail of the user's own tags — the Library filter.
 * Each tag also has an "Edit Tag" (rename) affordance: click the pencil to
 * turn that chip into an inline rename input; the mutation cascades to
 * every show/episode carrying the old tag.
 */
function SyncIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3" strokeLinecap="round" />
      <path d="M4 5v5h5M20 19v-5h-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TagRail({
  tags,
  active,
  onPick,
  onRename,
}: {
  tags: string[];
  active: string | null;
  onPick: (t: string | null) => void;
  onRename: (oldTag: string, newTag: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  if (tags.length === 0) {
    return (
      <p className="mb-5 rounded-[2px] border border-dashed border-surface-border px-3 py-2 text-xs text-zinc-500">
        No tags yet — add one right on a Show or Episode card below.
      </p>
    );
  }
  return (
    <div className="-mx-4 mb-5 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:-mx-8 sm:px-8">
      <NothingToggle
        active={active === null}
        onClick={() => onPick(null)}
        className="shrink-0 whitespace-nowrap"
      >
        All
      </NothingToggle>
      {tags.map((t) =>
        editing === t ? (
          <RenameInput
            key={t}
            initial={t}
            onCommit={(next) => {
              setEditing(null);
              if (next && next !== t) onRename(t, next);
            }}
          />
        ) : (
          <span key={t} className="inline-flex shrink-0 items-stretch">
            <NothingToggle
              active={active === t}
              onClick={() => onPick(active === t ? null : t)}
              className="whitespace-nowrap !rounded-r-none !border-r-0"
            >
              #{t}
            </NothingToggle>
            <button
              type="button"
              onClick={() => setEditing(t)}
              aria-label={`Edit tag ${t}`}
              title="Edit tag"
              data-active={active === t}
              className="nothing-toggle !rounded-l-none !border-l-0 px-1.5 text-[11px]"
            >
              ✎
            </button>
          </span>
        ),
      )}
    </div>
  );
}

function RenameInput({
  initial,
  onCommit,
}: {
  initial: string;
  onCommit: (next: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit(value.trim());
        if (e.key === "Escape") onCommit(initial);
      }}
      onBlur={() => onCommit(value.trim())}
      onFocus={(e) => e.currentTarget.select()}
      aria-label={`Rename tag ${initial}`}
      className="font-brand w-28 shrink-0 rounded-[2px] border border-foreground bg-background px-3 py-1.5 text-[11px] uppercase tracking-wider text-foreground focus:outline-none"
    />
  );
}



/**
 * The saved-episode list: one ordered list, drag to reorder, Archive as the
 * opt-out. The old Inbox/Queue split is gone — a triage step that demanded
 * a gesture per episode was filing work the user never did, so the pile
 * stayed a pile. Finding something to play is handled above by RightNow,
 * which needs no filing; this list is now just the collection itself.
 */
function EpisodesColumn({
  queue,
  archived,
  tagMap,
  loading,
  filtered,
  onTagsChanged,
  showFeedById,
}: {
  queue: SavedEpisode[];
  archived: SavedEpisode[];
  tagMap: EpisodeTagMap;
  loading: boolean;
  filtered: boolean;
  onTagsChanged: () => void;
  /** Parent show's RSS feed URL per showId — lets a queue row's YouTube
   *  Music fallback offer the same copy-RSS assist a show card gets
   *  (episodes have no feed of their own; it's their show's). */
  showFeedById: Map<string, string>;
}) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] });
  const [showArchived, setShowArchived] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Live local order for drag visuals — dnd-kit only animates a card's
  // slide-out-of-the-way when it's already inside the SAME SortableContext
  // items array the active card is being compared against at that instant.
  // Reacting only in onDragEnd (the previous version) computes the right
  // FINAL position but never shows the other cards moving live while
  // hovering — this is dnd-kit's own documented "multiple containers"
  // pattern: onDragOver keeps local order in sync with the pointer AS you
  // drag, onDragEnd just persists wherever that local order ended up.
  // Synced from the real data whenever it changes, except mid-drag (a
  // background refetch landing between dragstart/dragend shouldn't yank a
  // card out from under the pointer).
  const [localQueueIds, setLocalQueueIds] = useState<string[]>(() => queue.map((e) => e.episodeId));
  const draggingRef = useRef(false);
  // Magnetic snap: a per-id counter bumped each time a reorder actually
  // moves that card's slot, paired with a haptic tick — cards should feel
  // like they click into discrete positions, not silently reflow.
  const [snapPulses, setSnapPulses] = useState<Record<string, number>>({});
  function snapTo(id: string) {
    haptic("tick");
    setSnapPulses((p) => ({ ...p, [id]: (p[id] ?? 0) + 1 }));
  }
  const queueSignal = queue.map((e) => e.episodeId).join(",");
  useEffect(() => {
    if (draggingRef.current) return;
    setLocalQueueIds(queue.map((e) => e.episodeId));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signal is the intentional trigger
  }, [queueSignal]);

  // A delay (not distance) activation — the whole card is now both the
  // play target AND the drag source (no separate grip handle), so a quick
  // tap must always reach onPlay. A held press past the delay picks the
  // card up from anywhere on it; moving more than `tolerance` before the
  // delay elapses cancels activation so a scroll gesture that starts on a
  // card doesn't get eaten as a drag either.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  if (loading) return <p className="text-zinc-500">Loading…</p>;
  if (queue.length === 0 && archived.length === 0) {
    return (
      <p className="text-zinc-500">
        {filtered
          ? "No episodes with this tag."
          : "Nothing saved yet — tap “+ Later” on any episode."}
      </p>
    );
  }

  const episodeById = new Map(queue.map((e) => [e.episodeId, e]));
  const localQueue = localQueueIds
    .map((id) => episodeById.get(id))
    .filter((e): e is SavedEpisode => Boolean(e));

  const archive = (episodeId: string) =>
    void setEpisodeBucket(episodeId, "archived").then(refresh);
  const restore = (episodeId: string) =>
    void setEpisodeBucket(
      episodeId,
      "queue",
      rankForIndex(
        queue.map((e) => e.queueRank ?? 0),
        queue.length,
      ),
    ).then(refresh);

  const activeEpisode = activeId ? episodeById.get(activeId) : undefined;

  function containerOf(id: string): "queue" | null {
    return localQueueIds.includes(id) ? "queue" : null;
  }

  /** Keeps local order in sync AS the drag moves — see the state doc above. */
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || filtered) return;
    const draggedId = String(active.id);
    const overId = String(over.id);
    const overContainer =
      (over.data.current as { bucket?: "queue" } | undefined)?.bucket ?? containerOf(overId);
    if (!containerOf(draggedId) || overContainer !== "queue") return;

    setLocalQueueIds((ids) => {
      const oldIndex = ids.indexOf(draggedId);
      const newIndex = ids.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return ids;
      snapTo(overId);
      return arrayMove(ids, oldIndex, newIndex);
    });
  }

  /**
   * By the time a drag ends, onDragOver has already settled the local order
   * exactly where it visually landed — this just reads that final position
   * and persists it as a fractional queueRank (REFINEMENTS.md #1/#3),
   * touching only the moved row. A tag filter can't safely reorder (the
   * visible list is a subset — a position within it doesn't mean the same
   * thing once the filter clears), so dragging is disabled per-card in that
   * case (EpisodeCard's `disabled` prop) and this is a no-op backstop.
   */
  function handleDragEnd(event: DragEndEvent) {
    draggingRef.current = false;
    setActiveId(null);
    if (filtered) return;
    const draggedId = String(event.active.id);
    const dropIndex = localQueueIds.indexOf(draggedId);
    if (dropIndex === -1) return; // never entered the Queue
    const ranksWithoutActive = localQueueIds
      .filter((id) => id !== draggedId)
      .map((id) => episodeById.get(id)?.queueRank ?? 0);
    const rank = rankForIndex(ranksWithoutActive, dropIndex);
    void setEpisodeBucket(draggedId, "queue", rank).then(refresh);
  }

  function handleDragCancel() {
    draggingRef.current = false;
    setActiveId(null);
    setLocalQueueIds(queue.map((e) => e.episodeId));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => {
        draggingRef.current = true;
        setActiveId(String(e.active.id));
      }}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex flex-col gap-6">
        <QueueDropZone>
          {localQueue.length === 0 && (
            <li className="list-none text-sm text-zinc-500">
              {filtered ? "No saved episodes with this tag." : "Nothing saved yet."}
            </li>
          )}
          <SortableContext items={localQueueIds} strategy={rectSortingStrategy}>
            <AnimatePresence initial={false}>
              {localQueue.map((e) => (
                <EpisodeCard
                  key={e.episodeId}
                  episode={e}
                  tags={tagMap[e.episodeId] ?? []}
                  feedUrl={e.showId ? showFeedById.get(e.showId) : undefined}
                  onChanged={refresh}
                  onTagsChanged={onTagsChanged}
                  onArchive={() => archive(e.episodeId)}
                  disabled={filtered}
                  jiggle={activeId !== null && activeId !== e.episodeId}
                  snapPulseKey={snapPulses[e.episodeId]}
                />
              ))}
            </AnimatePresence>
          </SortableContext>
        </QueueDropZone>

        {archived.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="font-brand mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500 hover:text-foreground"
            >
              {showArchived ? "▾" : "▸"} Archived ({archived.length})
            </button>
            {showArchived && (
              <ul className="flex flex-col gap-3">
                {archived.map((e) => (
                  <ArchivedRow
                    key={e.episodeId}
                    episode={e}
                    onRestore={() => restore(e.episodeId)}
                    onRemove={() => void removeEpisode(e.episodeId).then(refresh)}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
        {activeEpisode && <DragPreviewCard episode={activeEpisode} />}
      </DragOverlay>
    </DndContext>
  );
}

/** Registers the Queue list itself as a drop target — needed so an empty
 *  queue, or the gap below its last card, still accepts a drop. */
function QueueDropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: "queue-container", data: { bucket: "queue" } });
  return (
    // Two columns from md up, one on mobile: a phone needs the full width
    // for a title to be readable, but on a desktop a single column wastes
    // most of the row and makes a long library needlessly tall.
    <ul ref={setNodeRef} className="grid min-h-[3rem] grid-cols-1 gap-3 md:grid-cols-2">
      {children}
    </ul>
  );
}

/** The floating "picked up" card that follows the pointer while dragging. */
function DragPreviewCard({ episode }: { episode: SavedEpisode }) {
  // The "picked up" iOS-icon feel: slightly larger and tilted, floating
  // above everything else with a real shadow — distinct from the flat list
  // rows it's hovering over.
  return (
    <div className="glass-panel flex w-full max-w-md scale-105 rotate-2 items-center gap-3 !rounded-[1.75rem] p-3 shadow-2xl">
      <span className="shrink-0 text-zinc-300">
        <GripIcon className="h-4 w-4" />
      </span>
      <CoverTile src={episode.coverUrl} size={48} className="!rounded-2xl" />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-semibold leading-snug">{episode.title}</p>
        {episode.showTitle && (
          <p className="line-clamp-1 text-sm text-muted-foreground">{episode.showTitle}</p>
        )}
      </div>
    </div>
  );
}

/** Archived — out of the way, restorable. Deliberately terse: title only. */
function ArchivedRow({
  episode,
  onRestore,
  onRemove,
}: {
  episode: SavedEpisode;
  onRestore: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-[2px] border border-surface-border px-3 py-2 opacity-70">
      <p className="line-clamp-1 min-w-0 flex-1 text-sm">{episode.title}</p>
      <button
        type="button"
        onClick={onRestore}
        aria-label={`Restore ${episode.title} to queue`}
        className="nothing-toggle shrink-0 px-2 py-1 text-[11px]"
      >
        Restore
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${episode.title}`}
        className="shrink-0 rounded-full px-2 py-1 text-muted-foreground hover:text-foreground"
      >
        ✕
      </button>
    </li>
  );
}

/**
 * The sync mechanic itself (REFINEMENTS.md #2): a private per-user feed
 * URL, add-by-URL once in any real podcast app, listen straight from
 * there from then on. Signed-in only — syncing to an external app needs a
 * stable server-side URL, same requirement as every other cross-device
 * feature here.
 */
function FeedSyncPanel({ signedIn }: { signedIn: boolean }) {
  const tokenQ = useQuery({
    queryKey: ["feedToken"],
    queryFn: getFeedToken,
    enabled: signedIn,
  });
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  if (!signedIn || !tokenQ.data) return null;
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/api/feed/listen-later/${tokenQ.data}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked — the URL is still visible to select manually
    }
  }

  async function regenerate() {
    if (!window.confirm("Regenerating invalidates the old feed URL — you'll need to re-add it in your podcast app. Continue?")) return;
    await regenerateFeedToken();
    await queryClient.invalidateQueries({ queryKey: ["feedToken"] });
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[2px] border border-dashed border-surface-border px-3 py-2 text-xs text-zinc-500">
      <span className="font-brand shrink-0 uppercase tracking-wider text-zinc-800 dark:text-zinc-100">
        Sync your Queue
      </span>
      <span className="min-w-0 flex-1 truncate">
        Add this feed URL in Apple Podcasts, Overcast, Pocket Casts, or AntennaPod — listen there, come
        back here to discover more.
      </span>
      <button type="button" onClick={copy} className="nothing-toggle shrink-0 px-2 py-1 text-[11px]">
        {copied ? "Copied ✓" : "Copy URL"}
      </button>
      <button type="button" onClick={regenerate} className="shrink-0 text-muted-foreground underline hover:text-foreground">
        Regenerate
      </button>
    </div>
  );
}

/**
 * Public "share your Queue" link — opt-in and off by default: nothing is
 * public until this toggle is used, same private-token-as-credential
 * pattern as FeedSyncPanel above, just gated behind an explicit on/off
 * instead of always-present. Signed-in only, for the same reason.
 */
function SharePanel({ signedIn }: { signedIn: boolean }) {
  const infoQ = useQuery({
    queryKey: ["shareInfo"],
    queryFn: getShareInfo,
    enabled: signedIn,
  });
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [naming, setNaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  if (!signedIn) return null;
  const token = infoQ.data?.token ?? null;
  const slug = infoQ.data?.slug ?? null;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = token ? `${origin}/u/${slug ?? token}` : null;

  function refresh() {
    return queryClient.invalidateQueries({ queryKey: ["shareInfo"] });
  }

  async function enable() {
    setBusy(true);
    await enableSharing();
    await refresh();
    setBusy(false);
  }

  async function disable() {
    if (!window.confirm("Turn off sharing? The current link will stop working immediately.")) return;
    setBusy(true);
    await disableSharing();
    await refresh();
    setBusy(false);
  }

  async function saveName() {
    setNameError(null);
    const result = await setShareSlug(nameDraft);
    if (!result.ok) {
      setNameError(result.error); // dupe or invalid — re-prompt with the reason, draft stays editable
      return;
    }
    setNaming(false);
    await refresh();
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked — the URL is still visible to select manually
    }
  }

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-[2px] border border-dashed border-surface-border px-3 py-2 text-xs text-zinc-500">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-brand shrink-0 uppercase tracking-wider text-zinc-800 dark:text-zinc-100">
          Share your Queue
        </span>
        {url ? (
          <>
            <span className="min-w-0 flex-1 truncate">{url}</span>
            <button type="button" onClick={copy} className="nothing-toggle shrink-0 px-2 py-1 text-[11px]">
              {copied ? "Copied ✓" : "Copy link"}
            </button>
            <button
              type="button"
              onClick={() => {
                setNameDraft(slug ?? "");
                setNameError(null);
                setNaming((v) => !v);
              }}
              className="shrink-0 text-muted-foreground underline hover:text-foreground"
            >
              {slug ? "Rename" : "Name this link"}
            </button>
            <button
              type="button"
              onClick={disable}
              disabled={busy}
              className="shrink-0 text-muted-foreground underline hover:text-foreground disabled:opacity-40"
            >
              Turn off
            </button>
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate">
              Off by default — turn on to get a public link to your current Queue.
            </span>
            <button
              type="button"
              onClick={enable}
              disabled={busy}
              className="nothing-toggle shrink-0 px-2 py-1 text-[11px] disabled:opacity-40"
            >
              Turn on
            </button>
          </>
        )}
      </div>
      {naming && (
        <div className="flex flex-wrap items-center gap-2 pl-1">
          <span className="shrink-0 text-muted-foreground">{`${origin}/u/`}</span>
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void saveName()}
            placeholder="your-name"
            autoFocus
            className="w-40 rounded-[2px] border border-surface-border bg-background px-2 py-1 text-xs text-foreground focus:border-foreground focus:outline-none"
          />
          <button type="button" onClick={() => void saveName()} className="nothing-toggle shrink-0 px-2 py-1 text-[11px]">
            Save name
          </button>
          <button
            type="button"
            onClick={() => setNaming(false)}
            className="shrink-0 text-muted-foreground underline hover:text-foreground"
          >
            Cancel
          </button>
          {nameError && <span className="w-full text-accent">{nameError}</span>}
        </div>
      )}
    </div>
  );
}

/**
 * One-shot manual pull sync from gpodder.net (REFINEMENTS.md #3): reconciles
 * play position from an external client (AntennaPod, gpodder desktop, ...)
 * back into the Library. Button-triggered only — no auto-run effect, and
 * the password is never persisted (not even in this component's own state
 * across a re-render beyond what's needed for the one request in flight).
 */
/**
 * Pocket Casts sync — played status and subscriptions, in one action.
 *
 * Signing in once was the ask: the first sync exchanges email+password for a
 * bearer token, and only the TOKEN is kept (in `prefs`, per-user and RLS'd,
 * so it follows you across devices). The password is never stored anywhere,
 * and the token can be revoked by changing the Pocket Casts password —
 * which a stored password could not be.
 *
 * Subscriptions are pulled ADDITIVELY and one-way: nothing is written back
 * to Pocket Casts, and unsubscribing there never removes a saved show here.
 */
function PocketCastsSyncPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "syncing" | "done" | "none" | "expired">("idle");
  const [result, setResult] = useState<{ episodes: number; shows: number }>({
    episodes: 0,
    shows: 0,
  });
  const queryClient = useQueryClient();

  const tokenQ = useQuery({ queryKey: ["pocketCastsToken"], queryFn: getPocketCastsToken });
  const connected = Boolean(tokenQ.data);

  async function sync() {
    setStatus("syncing");
    const token = tokenQ.data;
    const out = await syncFromPocketCasts(token ? { token } : { email, password });
    setPassword(""); // gone as soon as the one request has it
    setResult(out);
    if (out.expired) {
      setStatus("expired");
    } else {
      setStatus(out.episodes + out.shows > 0 ? "done" : "none");
    }
    await queryClient.invalidateQueries({ queryKey: ["pocketCastsToken"] });
    if (out.episodes + out.shows > 0) {
      refreshHistory();
      await queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] });
      await queryClient.invalidateQueries({ queryKey: ["saved"] });
    }
  }

  async function disconnect() {
    await setPocketCastsToken(null);
    setStatus("idle");
    await queryClient.invalidateQueries({ queryKey: ["pocketCastsToken"] });
  }

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-[2px] border border-dashed border-surface-border px-3 py-2 text-xs text-zinc-500">
      <span className="font-brand uppercase tracking-wider text-zinc-800 dark:text-zinc-100">
        Pocket Casts
      </span>
      <p className="text-[11px] leading-relaxed">
        Pulls your play history and your subscriptions. Episodes you finished there are marked
        finished here (so they stop being suggested), part-played ones get their real resume
        position, and shows you follow are added to your library. Adding only — unsubscribing in
        Pocket Casts never removes anything here. Your password is never stored; connecting keeps
        only a revocable access token.
      </p>

      {connected ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-accent">Connected</span>
          <button
            type="button"
            onClick={() => void sync()}
            disabled={status === "syncing"}
            className="font-brand rounded-[2px] border border-foreground px-3 py-1 text-[11px] uppercase tracking-wider text-foreground disabled:opacity-40"
          >
            {status === "syncing" ? "Syncing…" : "Sync now"}
          </button>
          <button
            type="button"
            onClick={() => void disconnect()}
            className="font-brand rounded-[2px] border border-surface-border px-3 py-1 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pocket casts email"
            autoComplete="off"
            className="w-40 rounded-[2px] border border-surface-border bg-background px-2 py-1 text-xs"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            autoComplete="off"
            className="w-32 rounded-[2px] border border-surface-border bg-background px-2 py-1 text-xs"
          />
          <button
            type="button"
            onClick={() => void sync()}
            disabled={!email || !password || status === "syncing"}
            className="font-brand rounded-[2px] border border-foreground px-3 py-1 text-[11px] uppercase tracking-wider text-foreground disabled:opacity-40"
          >
            {status === "syncing" ? "Connecting…" : "Connect"}
          </button>
        </div>
      )}

      {status === "done" && (
        <span className="text-accent">
          {result.episodes} episode{result.episodes === 1 ? "" : "s"} updated
          {result.shows > 0 && `, ${result.shows} show${result.shows === 1 ? "" : "s"} added`}
        </span>
      )}
      {status === "none" && <span>Already up to date — nothing changed</span>}
      {status === "expired" && (
        <span className="text-accent">
          Pocket Casts rejected the saved login — sign in again to reconnect.
        </span>
      )}
    </div>
  );
}

function GpodderSyncPanel() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [count, setCount] = useState(0);
  const queryClient = useQueryClient();

  async function sync() {
    setStatus("syncing");
    const updated = await syncFromGpodder(username, password);
    setPassword(""); // never keep it around longer than the one request needs
    setCount(updated);
    setStatus(updated > 0 ? "done" : "error");
    if (updated > 0) await queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] });
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[2px] border border-dashed border-surface-border px-3 py-2 text-xs text-zinc-500">
      <span className="font-brand shrink-0 uppercase tracking-wider text-zinc-800 dark:text-zinc-100">
        Sync from gpodder.net
      </span>
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="username"
        autoComplete="off"
        className="w-28 rounded-[2px] border border-surface-border bg-background px-2 py-1 text-xs"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="password"
        autoComplete="off"
        className="w-28 rounded-[2px] border border-surface-border bg-background px-2 py-1 text-xs"
      />
      <button
        type="button"
        onClick={() => void sync()}
        disabled={!username || !password || status === "syncing"}
        className="nothing-toggle shrink-0 px-2 py-1 text-[11px] disabled:opacity-40"
      >
        {status === "syncing" ? "Syncing…" : "Sync"}
      </button>
      {status === "done" && (
        <span className="shrink-0 text-accent">
          Synced {count} episode{count === 1 ? "" : "s"} ✓
        </span>
      )}
      {status === "error" && (
        <span className="shrink-0 text-muted-foreground">No matching episodes found — check your login.</span>
      )}
    </div>
  );
}

