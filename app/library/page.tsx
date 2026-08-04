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
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CatalogShow } from "@/src/data/catalog/types";
import { getRankedEpisodes, getShow } from "@/src/data/catalog/client";
import { listEpisodeTags, type EpisodeTagMap } from "@/src/data/repos/episodeTagsRepo";
import {
  listSavedEpisodes,
  removeEpisode,
  saveEpisode,
  setEpisodeBucket,
  syncFromGpodder,
  type SavedEpisode,
} from "@/src/data/repos/savedEpisodesRepo";
import {
  disableSharing,
  enableSharing,
  getFeedToken,
  getShareInfo,
  regenerateFeedToken,
  setShareSlug,
} from "@/src/data/repos/prefsRepo";
import { listSaved, unsaveShow } from "@/src/data/repos/savedShowsRepo";
import { rankForIndex } from "@/src/core/queue/rank";
import { clusterSavedShow } from "@/src/core/recommend";
import {
  addShowTag,
  allTagsFrom,
  listShowTags,
  removeShowTag,
  type ShowTagMap,
} from "@/src/data/repos/showTagsRepo";
import { renameTagEverywhere } from "@/src/data/repos/tagsRepo";
import { BulkYoutubeMusicButton } from "@/src/features/library/BulkYoutubeMusicButton";
import { EpisodeCard, GripIcon } from "@/src/features/library/EpisodeCard";
import { ExportOpmlButton } from "@/src/features/library/ExportOpmlButton";
import { ImportOpmlButton } from "@/src/features/library/ImportOpmlButton";
import { InlineTagInput } from "@/src/features/library/InlineTagInput";
import { OpenInLinks } from "@/src/features/library/OpenInLinks";
import { CoverPlay } from "@/src/features/player/CoverPlay";
import { previewShow } from "@/src/features/player/preview";
import { FloatingSearch } from "@/src/features/search/FloatingSearch";
import { useSession } from "@/src/state/useSession";
import { CoverTile, haptic, LiquidBackdrop, NothingToggle, PlayableCard } from "@/src/ui";

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

  // Inbox/Queue triage (REFINEMENTS.md #1/#3) — reordering needs the TRUE
  // queue order, so it's computed off the unfiltered list and only exposed
  // when no tag filter is narrowing the view (a filtered subset can't say
  // "swap with the next item" meaningfully).
  const fullQueue = [...episodes]
    .filter((e) => e.bucket === "queue")
    .sort((a, b) => (a.queueRank ?? 0) - (b.queueRank ?? 0));
  const inboxEpisodes = visibleEpisodes
    .filter((e) => e.bucket === "inbox")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-brand text-2xl font-bold">Library</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ImportOpmlButton />
          <ExportOpmlButton />
          <BulkYoutubeMusicButton />
        </div>
      </div>
      <p className="mb-4 text-zinc-500">
        Shows you follow and episodes queued for later — synced when signed in.
        Tag them right on their card to sort your Library.
      </p>

      <FeedSyncPanel signedIn={signedIn} />
      <SharePanel signedIn={signedIn} />
      <GpodderSyncPanel />

      <TagRail tags={allTags} active={tag} onPick={setActiveTag} onRename={renameTag} />

      {/* Episodes lead — Inbox and Queue side by side (the working area,
          triage in one glance) with Archived tucked below; Shows (the long
          reference list) sits in its own section underneath. */}
      <section>
        <ColumnHeading count={visibleEpisodes.length}>Episodes</ColumnHeading>
        <EpisodesColumn
          inbox={inboxEpisodes}
          queue={queueEpisodes}
          archived={archivedEpisodes}
          tagMap={episodeTagMap}
          loading={episodesQ.isLoading}
          filtered={Boolean(tag)}
          onTagsChanged={invalidateTags}
          showFeedById={showFeedById}
        />
      </section>

      <section className="mt-10">
        <ColumnHeading count={visibleSaved.length}>Shows</ColumnHeading>
        <ShowsColumn
          saved={visibleSaved}
          tagMap={showTagMap}
          loading={savedQ.isLoading}
          filtered={Boolean(tag)}
          onTagsChanged={invalidateTags}
        />
      </section>

      <FloatingSearch />
    </main>
  );
}

function ColumnHeading({
  children,
  count,
}: {
  children: React.ReactNode;
  count: number;
}) {
  return (
    <h2 className="font-brand mb-3 flex items-baseline gap-2 text-xs font-bold uppercase tracking-[0.22em] text-zinc-800 dark:text-zinc-100">
      {children}
      <span className="text-[11px] tracking-[0.2em] text-muted-foreground">{count}</span>
    </h2>
  );
}

/**
 * Horizontal, scrollable rail of the user's own tags — the Library filter.
 * Each tag also has an "Edit Tag" (rename) affordance: click the pencil to
 * turn that chip into an inline rename input; the mutation cascades to
 * every show/episode carrying the old tag.
 */
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

function ShowsColumn({
  saved,
  tagMap,
  loading,
  filtered,
  onTagsChanged,
}: {
  saved: { show: CatalogShow; savedAt: string }[];
  tagMap: ShowTagMap;
  loading: boolean;
  filtered: boolean;
  onTagsChanged: () => void;
}) {
  const queryClient = useQueryClient();

  // fresh lastEpisodeAt per saved show (cached; capped for politeness)
  const freshQ = useQueries({
    queries: saved.slice(0, 20).map((s) => ({
      queryKey: ["catalog", "show", s.show.id],
      queryFn: () => getShow(s.show.id),
      staleTime: 60 * 60 * 1000,
    })),
  });
  const freshById = new Map(
    freshQ.filter((q) => q.data).map((q) => [q.data!.id, q.data!]),
  );

  // A new episode of a saved show is the same kind of event as a fresh
  // Discovery save (REFINEMENTS.md #13) — route it into the same Inbox
  // for triage instead of a second, separate mechanism. `freshSignal` is a
  // primitive (compared by value, not reference), so this only re-runs when
  // the fetched dates actually change, not on every render.
  const freshSignal = freshQ.map((q) => q.data?.lastEpisodeAt ?? "").join(",");
  const autoInboxedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const { show, savedAt } of saved.slice(0, 20)) {
      const latest = freshById.get(show.id)?.lastEpisodeAt ?? show.lastEpisodeAt;
      if (!latest || Date.parse(latest) <= Date.parse(savedAt)) continue;
      const key = `${show.id}:${latest}`;
      if (autoInboxedRef.current.has(key)) continue;
      autoInboxedRef.current.add(key);
      void getRankedEpisodes(show.id).then((episodes) => {
        const newOnes = episodes.filter(
          (e) => e.publishedAt && Date.parse(e.publishedAt) > Date.parse(savedAt),
        );
        if (newOnes.length === 0) return;
        void Promise.all(
          newOnes.map((e) =>
            saveEpisode({
              id: e.id,
              title: e.title,
              showId: show.id,
              showTitle: show.title,
              coverUrl: show.coverUrl,
              appleUrl: show.appleUrl,
              audioUrl: e.audioUrl,
              durationSec: e.durationSec,
              categories: [],
            }),
          ),
        ).then(() => queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] }));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- freshSignal is the intentional trigger; saved/queryClient are stable enough here
  }, [freshSignal]);

  const remove = (id: string) =>
    void unsaveShow(id).then(() =>
      queryClient.invalidateQueries({ queryKey: ["saved"] }),
    );

  if (loading) return <p className="text-zinc-500">Loading…</p>;
  if (saved.length === 0) {
    return (
      <p className="text-zinc-500">
        {filtered ? "No shows with this tag." : "Nothing saved yet — search below to find your first show."}
      </p>
    );
  }

  const renderCards = (items: typeof saved) => (
    <ul className="flex flex-col gap-3">
      {items.map(({ show, savedAt }) => (
        <LibraryShowCard
          key={show.id}
          show={show}
          savedAt={savedAt}
          tags={tagMap[show.id] ?? []}
          fresh={freshById.get(show.id)}
          onRemove={() => remove(show.id)}
          onTagsChanged={onTagsChanged}
        />
      ))}
    </ul>
  );

  // Auto-shelves by taste cluster (REFINEMENTS.md #11) — only once the
  // Library has enough shows for grouping to help rather than fragment a
  // small list into singletons, and only with no manual tag filter active
  // (a filter is already the more specific ask). Reuses the recommendation
  // engine's own seed-cluster match, not a new taxonomy.
  const AUTO_SHELF_THRESHOLD = 8;
  if (filtered || saved.length < AUTO_SHELF_THRESHOLD) {
    return renderCards(saved);
  }

  const shelves = new Map<string, { label: string; items: typeof saved }>();
  const unsorted: typeof saved = [];
  for (const s of saved) {
    const match = clusterSavedShow({
      id: s.show.id,
      title: s.show.title,
      description: s.show.description,
      categories: s.show.categories,
    });
    if (!match) {
      unsorted.push(s);
      continue;
    }
    const shelf = shelves.get(match.id) ?? { label: match.label, items: [] };
    shelf.items.push(s);
    shelves.set(match.id, shelf);
  }

  return (
    <div className="flex flex-col gap-6">
      {[...shelves.values()].map((shelf) => (
        <div key={shelf.label}>
          <h3 className="font-brand mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
            {shelf.label}
          </h3>
          {renderCards(shelf.items)}
        </div>
      ))}
      {unsorted.length > 0 && (
        <div>
          <h3 className="font-brand mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
            Unsorted
          </h3>
          {renderCards(unsorted)}
        </div>
      )}
    </div>
  );
}

function LibraryShowCard({
  show,
  savedAt,
  tags,
  fresh,
  onRemove,
  onTagsChanged,
}: {
  show: CatalogShow;
  savedAt: string;
  tags: string[];
  fresh?: CatalogShow;
  onRemove: () => void;
  onTagsChanged: () => void;
}) {
  const latest = fresh?.lastEpisodeAt ?? show.lastEpisodeAt;
  const hasNew = Boolean(latest && Date.parse(latest) > Date.parse(savedAt));
  // feed-only imports have no catalog page to open
  const linkable = show.source !== "rss";

  return (
    <li>
      <PlayableCard
        onPlay={() => previewShow(show)}
        playLabel={`Preview ${show.title}`}
        // Liquid Glass card, organic curve — fixed height so every Show
        // card in the grid reads as identical size, regardless of title
        // length or tag count (tags/links already scroll horizontally in
        // a single row rather than wrapping taller).
        className="glass-panel h-32 cursor-pointer overflow-hidden !rounded-[1.75rem] shadow-lg"
      >
        <CoverPlay
          src={show.coverUrl}
          size={56}
          onPlay={() => previewShow(show)}
          label={`Play a snippet of ${show.title}`}
          className="relative z-10 !rounded-[2px]"
        />
        <div className="min-w-0 flex-1">
          <p className="font-brand line-clamp-2 font-bold leading-snug">
            {linkable ? (
              <Link
                href={`/show/${show.id}`}
                className="relative z-10 hover:text-accent hover:underline underline-offset-2"
              >
                {show.title}
              </Link>
            ) : (
              show.title
            )}
            {hasNew && (
              <span className="ml-2 rounded-pill bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
                New episode
              </span>
            )}
          </p>
          <p className="line-clamp-1 text-sm text-zinc-500">{show.author}</p>
          <OpenInLinks
            title={show.title}
            appleUrl={show.appleUrl}
            feedUrl={show.feedUrl}
            stored={show.platformLinks}
            showId={show.id}
            className="relative z-10 mt-1.5"
          />
          <InlineTagInput
            tags={tags}
            onAdd={(t) => void addShowTag(show.id, t).then(onTagsChanged)}
            onRemove={(t) => void removeShowTag(show.id, t).then(onTagsChanged)}
          />
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${show.title}`}
          className="relative z-10 shrink-0 rounded-full px-2 py-1 text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      </PlayableCard>
    </li>
  );
}

/**
 * Inbox/Queue triage (REFINEMENTS.md #1/#3): fresh saves land in an
 * untouched Inbox; one gesture commits each into a small, deliberately-
 * ordered Queue (or Archive). The Queue stays manageable precisely because
 * nothing enters it without a decision — see the design note in
 * REFINEMENTS.md §3 for the full rationale.
 */
function EpisodesColumn({
  inbox,
  queue,
  archived,
  tagMap,
  loading,
  filtered,
  onTagsChanged,
  showFeedById,
}: {
  inbox: SavedEpisode[];
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
  const [localInboxIds, setLocalInboxIds] = useState<string[]>(() => inbox.map((e) => e.episodeId));
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
  const inboxSignal = inbox.map((e) => e.episodeId).join(",");
  const queueSignal = queue.map((e) => e.episodeId).join(",");
  useEffect(() => {
    if (draggingRef.current) return;
    setLocalInboxIds(inbox.map((e) => e.episodeId));
    setLocalQueueIds(queue.map((e) => e.episodeId));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signals are the intentional trigger
  }, [inboxSignal, queueSignal]);

  // A short activation distance so a plain tap (to open the preview player)
  // doesn't get eaten as an accidental drag start.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  if (loading) return <p className="text-zinc-500">Loading…</p>;
  if (inbox.length === 0 && queue.length === 0 && archived.length === 0) {
    return (
      <p className="text-zinc-500">
        {filtered
          ? "No episodes with this tag."
          : "No episodes queued — tap “+ Later” on any episode."}
      </p>
    );
  }

  const episodeById = new Map([...inbox, ...queue].map((e) => [e.episodeId, e]));
  const localInbox = localInboxIds
    .map((id) => episodeById.get(id))
    .filter((e): e is SavedEpisode => Boolean(e));
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

  function containerOf(id: string): "inbox" | "queue" | null {
    if (localInboxIds.includes(id)) return "inbox";
    if (localQueueIds.includes(id)) return "queue";
    return null;
  }

  /** Keeps local order in sync AS the drag moves — see the state doc above. */
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || filtered) return;
    const draggedId = String(active.id);
    const overId = String(over.id);
    const activeContainer = containerOf(draggedId);
    const overContainer =
      (over.data.current as { bucket?: "inbox" | "queue" } | undefined)?.bucket ??
      containerOf(overId);
    if (!activeContainer || overContainer !== "queue") return; // only the Queue accepts drops

    if (activeContainer === "queue") {
      setLocalQueueIds((ids) => {
        const oldIndex = ids.indexOf(draggedId);
        const newIndex = ids.indexOf(overId);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return ids;
        snapTo(overId);
        return arrayMove(ids, oldIndex, newIndex);
      });
      return;
    }

    // Inbox -> Queue: remove from Inbox, insert into Queue at the hovered spot.
    setLocalInboxIds((ids) => ids.filter((id) => id !== draggedId));
    setLocalQueueIds((ids) => {
      if (ids.includes(draggedId)) return ids;
      snapTo(overId);
      const overIndex = ids.indexOf(overId);
      const next = [...ids];
      next.splice(overIndex === -1 ? next.length : overIndex, 0, draggedId);
      return next;
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
    setLocalInboxIds(inbox.map((e) => e.episodeId));
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
        <div className="grid items-start gap-6 md:grid-cols-2">
          <div>
            <h3 className="font-brand mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              Inbox <span className="text-muted-foreground">— new, not yet sorted</span>
            </h3>
            {localInbox.length === 0 ? (
              <p className="text-sm text-zinc-500">{"Nothing new — you're caught up."}</p>
            ) : (
              <SortableContext items={localInboxIds} strategy={verticalListSortingStrategy}>
                <ul className="flex flex-col gap-3">
                  <AnimatePresence initial={false}>
                    {localInbox.map((e) => (
                      <EpisodeCard
                        key={e.episodeId}
                        episode={e}
                        bucket="inbox"
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
                </ul>
              </SortableContext>
            )}
          </div>

          <div>
            <h3 className="font-brand mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              Queue
            </h3>
            <QueueDropZone>
              {localQueue.length === 0 && (
                <li className="list-none text-sm text-zinc-500">
                  {filtered
                    ? "No queued episodes with this tag."
                    : "Drag something over from your Inbox."}
                </li>
              )}
              <SortableContext items={localQueueIds} strategy={verticalListSortingStrategy}>
                <AnimatePresence initial={false}>
                  {localQueue.map((e) => (
                    <EpisodeCard
                      key={e.episodeId}
                      episode={e}
                      bucket="queue"
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
          </div>
        </div>

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
    <ul ref={setNodeRef} className="flex min-h-[3rem] flex-col gap-3">
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

