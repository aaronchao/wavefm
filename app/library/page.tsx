"use client";

import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CatalogShow } from "@/src/data/catalog/types";
import { getRankedEpisodes, getShow } from "@/src/data/catalog/client";
import {
  addEpisodeTag,
  listEpisodeTags,
  removeEpisodeTag,
  type EpisodeTagMap,
} from "@/src/data/repos/episodeTagsRepo";
import {
  listSavedEpisodes,
  removeEpisode,
  saveEpisode,
  setEpisodeBucket,
  syncFromGpodder,
  updateEpisodeProgress,
  type SavedEpisode,
} from "@/src/data/repos/savedEpisodesRepo";
import { getFeedToken, regenerateFeedToken } from "@/src/data/repos/prefsRepo";
import { listSaved, unsaveShow } from "@/src/data/repos/savedShowsRepo";
import { rankAfterAdjacentMove, rankAtBottom, rankAtTop } from "@/src/core/queue/rank";
import { clusterSavedShow } from "@/src/core/recommend";
import {
  addShowTag,
  allTagsFrom,
  listShowTags,
  removeShowTag,
  type ShowTagMap,
} from "@/src/data/repos/showTagsRepo";
import { renameTagEverywhere } from "@/src/data/repos/tagsRepo";
import { ExportOpmlButton } from "@/src/features/library/ExportOpmlButton";
import { ImportOpmlButton } from "@/src/features/library/ImportOpmlButton";
import { InlineTagInput } from "@/src/features/library/InlineTagInput";
import { OpenInLinks } from "@/src/features/library/OpenInLinks";
import { CoverPlay } from "@/src/features/player/CoverPlay";
import { previewEpisode, previewShow } from "@/src/features/player/preview";
import { FloatingSearch } from "@/src/features/search/FloatingSearch";
import { useSession } from "@/src/state/useSession";
import { NothingToggle, PlayableCard } from "@/src/ui";

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
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-brand text-2xl font-bold">Library</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ImportOpmlButton />
          <ExportOpmlButton />
        </div>
      </div>
      <p className="mb-4 text-zinc-500">
        Shows you follow and episodes queued for later — synced when signed in.
        Tag them right on their card to sort your Library.
      </p>

      <FeedSyncPanel signedIn={signedIn} />
      <GpodderSyncPanel />

      <TagRail tags={allTags} active={tag} onPick={setActiveTag} onRename={renameTag} />

      {/* On mobile (single column) Episodes lead — the saved-shows list is
          long, so the queue you actually reach for comes first; desktop keeps
          Shows on the left via order overrides. */}
      <div className="grid items-start gap-8 md:grid-cols-2">
        <section className="order-2 md:order-1">
          <ColumnHeading count={visibleSaved.length}>Shows</ColumnHeading>
          <ShowsColumn
            saved={visibleSaved}
            tagMap={showTagMap}
            loading={savedQ.isLoading}
            filtered={Boolean(tag)}
            onTagsChanged={invalidateTags}
          />
        </section>
        <section className="order-1 md:order-2">
          <ColumnHeading count={visibleEpisodes.length}>Episodes</ColumnHeading>
          <EpisodesColumn
            inbox={inboxEpisodes}
            queue={queueEpisodes}
            archived={archivedEpisodes}
            tagMap={episodeTagMap}
            loading={episodesQ.isLoading}
            filtered={Boolean(tag)}
            onTagsChanged={invalidateTags}
          />
        </section>
      </div>

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
      <span className="text-[11px] tracking-[0.2em] text-zinc-400">{count}</span>
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
        // Show identity: sharp corners, square cover — Nothing-brand.
        className="cursor-pointer !rounded-[2px]"
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
          className="relative z-10 shrink-0 rounded-full px-2 py-1 text-zinc-400 hover:text-foreground"
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
}: {
  inbox: SavedEpisode[];
  queue: SavedEpisode[];
  archived: SavedEpisode[];
  tagMap: EpisodeTagMap;
  loading: boolean;
  filtered: boolean;
  onTagsChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] });
  const [showArchived, setShowArchived] = useState(false);

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

  const moveToQueue = (episodeId: string, position: "top" | "bottom") => {
    const ranks = queue.map((e) => e.queueRank ?? 0);
    const rank = position === "top" ? rankAtTop(ranks) : rankAtBottom(ranks);
    void setEpisodeBucket(episodeId, "queue", rank).then(refresh);
  };
  const archive = (episodeId: string) =>
    void setEpisodeBucket(episodeId, "archived").then(refresh);
  const restore = (episodeId: string) =>
    void setEpisodeBucket(episodeId, "queue", rankAtBottom(queue.map((e) => e.queueRank ?? 0))).then(
      refresh,
    );
  const move = (episodeId: string, direction: "up" | "down") => {
    const index = queue.findIndex((e) => e.episodeId === episodeId);
    const rank = rankAfterAdjacentMove(queue.map((e) => e.queueRank ?? 0), index, direction);
    if (rank == null) return; // already at that edge
    void setEpisodeBucket(episodeId, "queue", rank).then(refresh);
  };

  return (
    <div className="flex flex-col gap-6">
      {inbox.length > 0 && (
        <div>
          <h3 className="font-brand mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
            Inbox <span className="text-zinc-400">— new, not yet sorted</span>
          </h3>
          <ul className="flex flex-col gap-3">
            {inbox.map((e) => (
              <InboxRow
                key={e.episodeId}
                episode={e}
                onTopOfQueue={() => moveToQueue(e.episodeId, "top")}
                onBottomOfQueue={() => moveToQueue(e.episodeId, "bottom")}
                onArchive={() => archive(e.episodeId)}
              />
            ))}
          </ul>
        </div>
      )}

      <div>
        {inbox.length > 0 && (
          <h3 className="font-brand mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
            Queue
          </h3>
        )}
        {queue.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {filtered ? "No queued episodes with this tag." : "Triage something from your Inbox above."}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {queue.map((e, i) => (
              <EpisodeRow
                key={e.episodeId}
                episode={e}
                tags={tagMap[e.episodeId] ?? []}
                onChanged={refresh}
                onTagsChanged={onTagsChanged}
                onMoveUp={!filtered && i > 0 ? () => move(e.episodeId, "up") : undefined}
                onMoveDown={
                  !filtered && i < queue.length - 1 ? () => move(e.episodeId, "down") : undefined
                }
              />
            ))}
          </ul>
        )}
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
  );
}

/** A fresh, untriaged save — minimal by design (it's a holding area, not a working list). */
function InboxRow({
  episode,
  onTopOfQueue,
  onBottomOfQueue,
  onArchive,
}: {
  episode: SavedEpisode;
  onTopOfQueue: () => void;
  onBottomOfQueue: () => void;
  onArchive: () => void;
}) {
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
    <li>
      <PlayableCard onPlay={play} playLabel={`Preview ${episode.title}`} className="cursor-pointer !rounded-[2px]">
        <CoverPlay src={episode.coverUrl} size={48} onPlay={play} label={`Play a snippet of ${episode.title}`} className="relative z-10 !rounded-[2px]" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug">{episode.title}</p>
          {episode.showTitle && (
            <p className="line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">{episode.showTitle}</p>
          )}
        </div>
        <div className="relative z-10 flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onTopOfQueue(); }}
            aria-label={`Move ${episode.title} to top of queue`}
            title="Top of queue"
            className="nothing-toggle px-2 py-1 text-[11px]"
          >
            ↑ Top
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onBottomOfQueue(); }}
            aria-label={`Move ${episode.title} to bottom of queue`}
            title="Bottom of queue"
            className="nothing-toggle px-2 py-1 text-[11px]"
          >
            ↓ Bottom
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onArchive(); }}
            aria-label={`Archive ${episode.title}`}
            title="Not interested — archive"
            className="rounded-full px-2 py-1 text-zinc-400 hover:text-foreground"
          >
            ✕
          </button>
        </div>
      </PlayableCard>
    </li>
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
        className="shrink-0 rounded-full px-2 py-1 text-zinc-400 hover:text-foreground"
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
      <button type="button" onClick={regenerate} className="shrink-0 text-zinc-400 underline hover:text-foreground">
        Regenerate
      </button>
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
        <span className="shrink-0 text-zinc-400">No matching episodes found — check your login.</span>
      )}
    </div>
  );
}

function EpisodeRow({
  episode,
  tags,
  onChanged,
  onTagsChanged,
  onMoveUp,
  onMoveDown,
}: {
  episode: SavedEpisode;
  tags: string[];
  onChanged: () => void;
  onTagsChanged: () => void;
  /** Undefined hides the button — used at queue edges and while tag-filtered. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
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
    <li>
      <PlayableCard
        onPlay={play}
        playLabel={`Preview ${episode.title}`}
        // Episode identity now matches Shows: sharp corners, square cover.
        className={`cursor-pointer !rounded-[2px] ${finished ? "opacity-60" : ""}`}
      >
        <CoverPlay
          src={episode.coverUrl}
          size={56}
          onPlay={play}
          label={`Play a snippet of ${episode.title}`}
          className="relative z-10 !rounded-[2px]"
        />
        <div className="min-w-0 flex-1">
          {episode.showId ? (
            <Link
              href={`/show/${episode.showId}`}
              className={`relative z-10 line-clamp-3 font-semibold leading-snug hover:text-accent hover:underline underline-offset-2 ${finished ? "line-through" : ""}`}
            >
              {episode.title}
            </Link>
          ) : (
            <p className={`line-clamp-3 font-semibold leading-snug ${finished ? "line-through" : ""}`}>
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
          <p className="truncate text-xs text-zinc-400">
            {finished ? "Finished" : episode.status === "in_progress" ? "In progress" : "Queued"}
            {resume ? ` · ${resume}` : ""}
            {episode.appleUrl ? "" : " · preview only"}
          </p>
          <OpenInLinks
            title={episode.showTitle ? `${episode.showTitle} ${episode.title}` : episode.title}
            appleUrl={episode.appleUrl}
            showId={episode.showId}
            className="relative z-10 mt-1.5"
          />
          <InlineTagInput
            tags={tags}
            onAdd={(t) => void addEpisodeTag(episode.episodeId, t).then(onTagsChanged)}
            onRemove={(t) => void removeEpisodeTag(episode.episodeId, t).then(onTagsChanged)}
          />
        </div>
        {(onMoveUp || onMoveDown) && (
          <div className="relative z-10 flex shrink-0 flex-col">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }}
              disabled={!onMoveUp}
              aria-label={`Move ${episode.title} up in queue`}
              title="Move up"
              className="px-1.5 text-zinc-400 hover:text-foreground disabled:opacity-20"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
              disabled={!onMoveDown}
              aria-label={`Move ${episode.title} down in queue`}
              title="Move down"
              className="px-1.5 text-zinc-400 hover:text-foreground disabled:opacity-20"
            >
              ▼
            </button>
          </div>
        )}
        <NothingToggle
          active={finished}
          onClick={(e) => {
            e.stopPropagation();
            toggleFinished();
          }}
          className="relative z-10 shrink-0"
        >
          {finished ? "Finished ✓" : "Done?"}
        </NothingToggle>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void removeEpisode(episode.episodeId).then(onChanged);
          }}
          aria-label={`Remove ${episode.title}`}
          className="relative z-10 shrink-0 rounded-full px-2 py-1 text-zinc-400 hover:text-foreground"
        >
          ✕
        </button>
      </PlayableCard>
    </li>
  );
}
