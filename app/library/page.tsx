"use client";

import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { type Group, groupByCategory, groupByVibe } from "@/src/core/library/organize";
import type { CatalogShow } from "@/src/data/catalog/types";
import { getShow } from "@/src/data/catalog/client";
import {
  listSavedEpisodes,
  removeEpisode,
  updateEpisodeProgress,
  type SavedEpisode,
} from "@/src/data/repos/savedEpisodesRepo";
import { listSaved, unsaveShow } from "@/src/data/repos/savedShowsRepo";
import { ExportOpmlButton } from "@/src/features/library/ExportOpmlButton";
import { ImportOpmlButton } from "@/src/features/library/ImportOpmlButton";
import { OpenInLinks } from "@/src/features/library/OpenInLinks";
import { previewEpisode, previewShow } from "@/src/features/player/preview";
import { useSession } from "@/src/state/useSession";
import { Chip, CoverTile, PlayableCard } from "@/src/ui";

/**
 * Library: the collection system. The Shows tab auto-organizes a growing pile
 * of follows two ways — by Category (中文 / topics) or by Vibe (🕳️ Rabbit
 * holes, ☕ Cozy corner…), so it never becomes one endless scroll. Listen later
 * holds queued episodes with status + resume point. Everything syncs via
 * Supabase when signed in, localStorage otherwise.
 */
export default function LibraryPage() {
  const [tab, setTab] = useState<"shows" | "episodes">("shows");

  return (
    <main className="mx-auto w-full max-w-3xl p-4 pb-40 sm:p-8 sm:pb-40">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Library</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ImportOpmlButton />
          <ExportOpmlButton />
        </div>
      </div>
      <p className="mb-4 text-zinc-500">
        Shows you follow and episodes queued for later — synced when signed in.
        Import from another app, or export any time to take them elsewhere.
      </p>
      <div className="mb-5 flex gap-2">
        <Chip active={tab === "shows"} onClick={() => setTab("shows")}>
          Shows
        </Chip>
        <Chip active={tab === "episodes"} onClick={() => setTab("episodes")}>
          Listen later
        </Chip>
      </div>
      {tab === "shows" ? <ShowsTab /> : <EpisodesTab />}
    </main>
  );
}

/** Below this many follows, grouping is noise — show a plain list. */
const GROUP_THRESHOLD = 4;

function ShowsTab() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const scope = session?.user.id ?? "local";
  const savedQ = useQuery({ queryKey: ["saved", scope], queryFn: listSaved });
  const saved = savedQ.data ?? [];

  const [view, setView] = useState<"category" | "vibe">("category");
  const [filter, setFilter] = useState<string | null>(null);

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

  if (savedQ.isLoading) return <p className="text-zinc-500">Loading…</p>;
  if (saved.length === 0) {
    return (
      <p className="text-zinc-500">
        Nothing saved yet — find your first show in{" "}
        <Link href="/search" className="underline">
          Search
        </Link>
        .
      </p>
    );
  }

  const shows = saved.map((s) => s.show);
  const savedAtById = new Map(saved.map((s) => [s.show.id, s.savedAt]));
  const grouped = saved.length >= GROUP_THRESHOLD;
  const groups: Group<CatalogShow>[] = !grouped
    ? [{ key: "", items: shows }]
    : view === "category"
      ? groupByCategory(shows)
      : groupByVibe(shows);
  const visible = filter ? groups.filter((g) => g.key === filter) : groups;

  return (
    <div>
      {grouped && (
        <div className="mb-5 flex flex-col gap-3">
          <ViewSwitcher
            view={view}
            onChange={(v) => {
              setView(v);
              setFilter(null);
            }}
          />
          {view === "category" && groups.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <Chip active={filter === null} onClick={() => setFilter(null)}>
                All
              </Chip>
              {groups.map((g) => (
                <Chip
                  key={g.key}
                  active={filter === g.key}
                  onClick={() => setFilter((cur) => (cur === g.key ? null : g.key))}
                >
                  {g.key} · {g.items.length}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-8">
        {visible.map((group) => (
          <section key={group.key || "all"}>
            {grouped && group.key && (
              <h2 className="mb-3 flex items-baseline gap-2">
                <span className="text-base font-semibold">
                  {group.emoji ? `${group.emoji} ` : ""}
                  {group.key}
                </span>
                <span className="font-brand text-[11px] uppercase tracking-[0.2em] text-zinc-400">
                  {group.items.length}
                </span>
              </h2>
            )}
            <ul className="flex flex-col gap-3">
              {group.items.map((show) => (
                <LibraryShowCard
                  key={show.id}
                  show={show}
                  savedAt={savedAtById.get(show.id)!}
                  fresh={freshById.get(show.id)}
                  onRemove={() => remove(show.id)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function ViewSwitcher({
  view,
  onChange,
}: {
  view: "category" | "vibe";
  onChange: (v: "category" | "vibe") => void;
}) {
  return (
    <div className="inline-flex w-fit rounded-pill border border-surface-border bg-surface p-0.5">
      {(["category", "vibe"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={view === v}
          className={`font-brand rounded-pill px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
            view === v ? "bg-accent text-white" : "text-zinc-500 hover:text-foreground"
          }`}
        >
          {v === "category" ? "Categories" : "Vibes"}
        </button>
      ))}
    </div>
  );
}

function LibraryShowCard({
  show,
  savedAt,
  fresh,
  onRemove,
}: {
  show: CatalogShow;
  savedAt: string;
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
          {latest && (
            <p className="truncate text-xs text-zinc-400">
              Latest: {new Date(latest).toLocaleDateString()}
            </p>
          )}
          <OpenInLinks
            title={show.title}
            appleUrl={show.appleUrl}
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

function EpisodesTab() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const scope = session?.user.id ?? "local";
  const { data, isLoading } = useQuery({
    queryKey: ["savedEpisodes", scope],
    queryFn: listSavedEpisodes,
  });
  const episodes = data ?? [];

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] });

  if (isLoading) return <p className="text-zinc-500">Loading…</p>;
  if (episodes.length === 0) {
    return (
      <p className="text-zinc-500">
        No episodes queued — tap “+ Later” on any episode in Search or a
        show page.
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
        {episode.appleUrl && (
          <a
            href={episode.appleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-10 shrink-0 rounded-pill bg-surface px-3 py-1.5 text-sm font-medium hover:opacity-80"
          >
            Full ↗
          </a>
        )}
        <Chip
          active={finished}
          onClick={() => toggleFinished()}
          className="relative z-10 shrink-0"
        >
          {finished ? "Finished ✓" : "Done?"}
        </Chip>
        <Chip
          onClick={() => void removeEpisode(episode.episodeId).then(onChanged)}
          className="relative z-10 shrink-0"
        >
          ✕
        </Chip>
      </PlayableCard>
    </li>
  );
}
