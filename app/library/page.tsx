"use client";

import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import type { CatalogShow } from "@/src/data/catalog/types";
import { getShow } from "@/src/data/catalog/client";
import {
  listSavedEpisodes,
  removeEpisode,
  updateEpisodeProgress,
  type SavedEpisode,
} from "@/src/data/repos/savedEpisodesRepo";
import { listSaved, unsaveShow } from "@/src/data/repos/savedShowsRepo";
import {
  allTagsFrom,
  listShowTags,
  type ShowTagMap,
} from "@/src/data/repos/showTagsRepo";
import { ExportOpmlButton } from "@/src/features/library/ExportOpmlButton";
import { ImportOpmlButton } from "@/src/features/library/ImportOpmlButton";
import { OpenInLinks } from "@/src/features/library/OpenInLinks";
import { previewEpisode, previewShow } from "@/src/features/player/preview";
import { FloatingSearch } from "@/src/features/search/FloatingSearch";
import { useSession } from "@/src/state/useSession";
import { Chip, CoverTile, NothingToggle, PlayableCard } from "@/src/ui";

/**
 * Library: the collection system, now a single 2-column grid — Shows beside
 * Episodes (formerly "Listen later") — with a horizontal rail of the user's
 * own tags across the top. Tapping a tag filters both columns at once. Tags
 * are added on a show's page and sync here. Everything syncs via Supabase
 * when signed in, localStorage otherwise.
 */
export default function LibraryPage() {
  const { session } = useSession();
  const scope = session?.user.id ?? "local";

  const savedQ = useQuery({ queryKey: ["saved", scope], queryFn: listSaved });
  const episodesQ = useQuery({
    queryKey: ["savedEpisodes", scope],
    queryFn: listSavedEpisodes,
  });
  const tagsQ = useQuery({ queryKey: ["showTags", scope], queryFn: listShowTags });

  const saved = savedQ.data ?? [];
  const episodes = episodesQ.data ?? [];
  const tagMap: ShowTagMap = tagsQ.data ?? {};
  const allTags = allTagsFrom(tagMap);

  const [activeTag, setActiveTag] = useState<string | null>(null);
  // a filter for a tag that no longer exists falls back to "All"
  const tag = activeTag && allTags.includes(activeTag) ? activeTag : null;

  const visibleSaved = tag
    ? saved.filter((s) => tagMap[s.show.id]?.includes(tag))
    : saved;
  const visibleEpisodes = tag
    ? episodes.filter((e) => e.showId != null && tagMap[e.showId]?.includes(tag))
    : episodes;

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
        Tag shows on their page to sort them here.
      </p>

      <TagRail tags={allTags} active={tag} onPick={setActiveTag} />

      <div className="grid items-start gap-8 md:grid-cols-2">
        <section>
          <ColumnHeading count={visibleSaved.length}>Shows</ColumnHeading>
          <ShowsColumn
            saved={visibleSaved}
            tagMap={tagMap}
            loading={savedQ.isLoading}
            filtered={Boolean(tag)}
          />
        </section>
        <section>
          <ColumnHeading count={visibleEpisodes.length}>Episodes</ColumnHeading>
          <EpisodesColumn
            episodes={visibleEpisodes}
            loading={episodesQ.isLoading}
            filtered={Boolean(tag)}
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

/** Horizontal, scrollable rail of the user's own tags — the Library filter. */
function TagRail({
  tags,
  active,
  onPick,
}: {
  tags: string[];
  active: string | null;
  onPick: (t: string | null) => void;
}) {
  if (tags.length === 0) {
    return (
      <p className="mb-5 rounded-[2px] border border-dashed border-surface-border px-3 py-2 text-xs text-zinc-500">
        No tags yet — open a show and add your own to sort your Library.
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
      {tags.map((t) => (
        <NothingToggle
          key={t}
          active={active === t}
          onClick={() => onPick(active === t ? null : t)}
          className="shrink-0 whitespace-nowrap"
        >
          #{t}
        </NothingToggle>
      ))}
    </div>
  );
}

function ShowsColumn({
  saved,
  tagMap,
  loading,
  filtered,
}: {
  saved: { show: CatalogShow; savedAt: string }[];
  tagMap: ShowTagMap;
  loading: boolean;
  filtered: boolean;
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
        {filtered ? (
          "No shows with this tag."
        ) : (
          <>Nothing saved yet — search below to find your first show.</>
        )}
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
}: {
  show: CatalogShow;
  savedAt: string;
  tags: string[];
  fresh?: CatalogShow;
  onRemove: () => void;
}) {
  const latest = fresh?.lastEpisodeAt ?? show.lastEpisodeAt;
  const hasNew = Boolean(latest && Date.parse(latest) > Date.parse(savedAt));

  return (
    <li>
      <PlayableCard
        onPlay={() => previewShow(show)}
        playLabel={`Preview ${show.title}`}
        className="cursor-pointer"
      >
        <CoverTile src={show.coverUrl} size={56} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-semibold leading-snug">
            {show.title}
            {hasNew && (
              <span className="ml-2 rounded-pill bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
                New episode
              </span>
            )}
          </p>
          <p className="line-clamp-1 text-sm text-zinc-500">{show.author}</p>
          {tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {tags.map((t) => (
                <span
                  key={t}
                  className="font-brand rounded-[2px] border border-surface-border px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-zinc-500"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
          <OpenInLinks
            title={show.title}
            appleUrl={show.appleUrl}
            feedUrl={show.feedUrl}
            stored={show.platformLinks}
            className="relative z-10 mt-1.5"
          />
        </div>
        {/* feed-only imports have no catalog page to open */}
        {show.source !== "rss" && (
          <Link
            href={`/show/${show.id}`}
            className="relative z-10 shrink-0 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Details →
          </Link>
        )}
        <Chip onClick={onRemove} className="relative z-10 shrink-0">
          Remove
        </Chip>
      </PlayableCard>
    </li>
  );
}

function EpisodesColumn({
  episodes,
  loading,
  filtered,
}: {
  episodes: SavedEpisode[];
  loading: boolean;
  filtered: boolean;
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
        <EpisodeRow key={e.episodeId} episode={e} onChanged={refresh} />
      ))}
    </ul>
  );
}

function EpisodeRow({
  episode,
  onChanged,
}: {
  episode: SavedEpisode;
  onChanged: () => void;
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

  return (
    <li>
      <PlayableCard
        onPlay={() =>
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
          })
        }
        playLabel={`Preview ${episode.title}`}
        className={`cursor-pointer ${finished ? "opacity-60" : ""}`}
      >
        <CoverTile src={episode.coverUrl} size={56} />
        <div className="min-w-0 flex-1">
          <p className={`line-clamp-2 font-semibold leading-snug ${finished ? "line-through" : ""}`}>
            {episode.title}
          </p>
          {episode.showTitle && (
            <p className="line-clamp-1 text-sm text-zinc-500">{episode.showTitle}</p>
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
