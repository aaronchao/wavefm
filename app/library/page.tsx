"use client";

import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import type { CatalogShow } from "@/src/data/catalog/types";
import { getShow } from "@/src/data/catalog/client";
import {
  addEpisodeTag,
  listEpisodeTags,
  removeEpisodeTag,
  type EpisodeTagMap,
} from "@/src/data/repos/episodeTagsRepo";
import {
  listSavedEpisodes,
  removeEpisode,
  updateEpisodeProgress,
  type SavedEpisode,
} from "@/src/data/repos/savedEpisodesRepo";
import { listSaved, unsaveShow } from "@/src/data/repos/savedShowsRepo";
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

  async function renameTag(oldTag: string, newTag: string) {
    if (activeTag === oldTag) setActiveTag(newTag.trim() || null);
    await renameTagEverywhere(oldTag, newTag);
    invalidateTags();
  }

  return (
    <main className="mx-auto w-full max-w-5xl p-4 pb-56 sm:p-8 sm:pb-56">
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
            episodes={visibleEpisodes}
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

  return (
    <ul className="flex flex-col gap-3">
      {saved.map(({ show, savedAt }) => (
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

function EpisodesColumn({
  episodes,
  tagMap,
  loading,
  filtered,
  onTagsChanged,
}: {
  episodes: SavedEpisode[];
  tagMap: EpisodeTagMap;
  loading: boolean;
  filtered: boolean;
  onTagsChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] });

  if (loading) return <p className="text-zinc-500">Loading…</p>;
  if (episodes.length === 0) {
    return (
      <p className="text-zinc-500">
        {filtered
          ? "No episodes with this tag."
          : "No episodes queued — tap “+ Later” on any episode."}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {episodes.map((e) => (
        <EpisodeRow
          key={e.episodeId}
          episode={e}
          tags={tagMap[e.episodeId] ?? []}
          onChanged={refresh}
          onTagsChanged={onTagsChanged}
        />
      ))}
    </ul>
  );
}

function EpisodeRow({
  episode,
  tags,
  onChanged,
  onTagsChanged,
}: {
  episode: SavedEpisode;
  tags: string[];
  onChanged: () => void;
  onTagsChanged: () => void;
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
          {episode.showTitle && (
            <p className="line-clamp-1 text-sm text-zinc-500 dark:text-zinc-400">{episode.showTitle}</p>
          )}
          <p className="truncate text-xs text-zinc-400">
            {finished ? "Finished" : episode.status === "in_progress" ? "In progress" : "Queued"}
            {resume ? ` · ${resume}` : ""}
            {episode.appleUrl ? "" : " · preview only"}
          </p>
          <OpenInLinks
            title={episode.showTitle ? `${episode.showTitle} ${episode.title}` : episode.title}
            appleUrl={episode.appleUrl}
            className="relative z-10 mt-1.5"
          />
          <InlineTagInput
            tags={tags}
            onAdd={(t) => void addEpisodeTag(episode.episodeId, t).then(onTagsChanged)}
            onRemove={(t) => void removeEpisodeTag(episode.episodeId, t).then(onTagsChanged)}
          />
        </div>
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
