"use client";

import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { getShow } from "@/src/data/catalog/client";
import {
  listSavedEpisodes,
  removeEpisode,
  updateEpisodeProgress,
  type SavedEpisode,
} from "@/src/data/repos/savedEpisodesRepo";
import { listSaved, unsaveShow } from "@/src/data/repos/savedShowsRepo";
import { previewEpisode, previewShow } from "@/src/features/player/preview";
import { useSession } from "@/src/state/useSession";
import { Card, Chip, CoverTile, SettleIn } from "@/src/ui";

/**
 * Library: the collection system. Shows tab tracks what you follow (with
 * a "new episode" badge when a feed published after you saved it);
 * Listen later holds liked episodes with status + resume point, synced
 * via Supabase when signed in, localStorage otherwise.
 */
export default function LibraryPage() {
  const [tab, setTab] = useState<"shows" | "episodes">("shows");

  return (
    <main className="mx-auto w-full max-w-2xl p-4 pb-40 sm:p-8 sm:pb-40">
      <h1 className="mb-1 text-2xl font-bold">Library</h1>
      <p className="mb-4 text-zinc-500">
        Shows you follow and episodes queued for later — synced when signed in.
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

function ShowsTab() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const scope = session?.user.id ?? "local";
  const savedQ = useQuery({ queryKey: ["saved", scope], queryFn: listSaved });
  const saved = savedQ.data ?? [];

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

  return (
    <ul className="flex flex-col gap-3">
      {saved.map(({ show, savedAt }) => {
        const fresh = freshById.get(show.id);
        const latest = fresh?.lastEpisodeAt ?? show.lastEpisodeAt;
        const hasNew = Boolean(latest && Date.parse(latest) > Date.parse(savedAt));
        return (
          <li key={show.id}>
            <SettleIn>
              <Card
                role="button"
                tabIndex={0}
                onClick={() => previewShow(show)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    previewShow(show);
                  }
                }}
                className="flex cursor-pointer items-center gap-3"
              >
                <CoverTile src={show.coverUrl} size={56} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {show.title}
                    {hasNew && (
                      <span className="ml-2 rounded-pill bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
                        New episode
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm text-zinc-500">{show.author}</p>
                  {latest && (
                    <p className="truncate text-xs text-zinc-400">
                      Latest: {new Date(latest).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Link
                  href={`/show/${show.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Details →
                </Link>
                <Chip
                  onClick={(e) => {
                    e.stopPropagation();
                    void unsaveShow(show.id).then(() =>
                      queryClient.invalidateQueries({ queryKey: ["saved"] }),
                    );
                  }}
                  className="shrink-0"
                >
                  Remove
                </Chip>
              </Card>
            </SettleIn>
          </li>
        );
      })}
    </ul>
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
      <SettleIn>
        <Card
          role="button"
          tabIndex={0}
          onClick={() =>
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
          onKeyDown={() => {}}
          className={`flex cursor-pointer items-center gap-3 ${finished ? "opacity-60" : ""}`}
        >
          <CoverTile src={episode.coverUrl} size={56} />
          <div className="min-w-0 flex-1">
            <p className={`truncate font-semibold ${finished ? "line-through" : ""}`}>
              {episode.title}
            </p>
            {episode.showTitle && (
              <p className="truncate text-sm text-zinc-500">{episode.showTitle}</p>
            )}
            <p className="truncate text-xs text-zinc-400">
              {finished ? "Finished" : episode.status === "in_progress" ? "In progress" : "Queued"}
              {resume ? ` · ${resume}` : ""}
              {episode.appleUrl ? "" : " · preview only"}
            </p>
          </div>
          {episode.appleUrl && (
            <a
              href={episode.appleUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 rounded-pill bg-surface px-3 py-1.5 text-sm font-medium hover:opacity-80"
            >
              Full ↗
            </a>
          )}
          <Chip
            active={finished}
            onClick={(e) => {
              e.stopPropagation();
              toggleFinished();
            }}
            className="shrink-0"
          >
            {finished ? "Finished ✓" : "Done?"}
          </Chip>
          <Chip
            onClick={(e) => {
              e.stopPropagation();
              void removeEpisode(episode.episodeId).then(onChanged);
            }}
            className="shrink-0"
          >
            ✕
          </Chip>
        </Card>
      </SettleIn>
    </li>
  );
}
