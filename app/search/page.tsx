"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { searchShows } from "@/src/data/catalog/client";
import type { CatalogEpisode, CatalogShow } from "@/src/data/catalog/types";
import {
  isEpisodeSaved,
  removeEpisode,
  saveEpisode,
} from "@/src/data/repos/savedEpisodesRepo";
import { isSaved, saveShow, unsaveShow } from "@/src/data/repos/savedShowsRepo";
import { previewEpisode, previewShow } from "@/src/features/player/preview";
import { SimilarContent } from "@/src/features/show/SimilarContent";
import { Chip, CoverTile, PlayableCard } from "@/src/ui";

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;
const PAGE_SIZE = 6;

export default function SearchPage() {
  return (
    <Suspense>
      <SearchInner />
    </Suspense>
  );
}

function SearchInner() {
  // deep-linkable: /search?q=故事FM (used by chart rows to jump to a show)
  const initial = useSearchParams().get("q") ?? "";
  const [input, setInput] = useState(initial);
  const [term, setTerm] = useState(initial.trim());
  const [showCount, setShowCount] = useState(PAGE_SIZE);
  const [epCount, setEpCount] = useState(PAGE_SIZE);

  // live search: results appear as you type, no Search click needed
  useEffect(() => {
    const next = input.trim();
    const timer = setTimeout(() => {
      setTerm(next.length >= MIN_QUERY_LENGTH ? next : "");
      setShowCount(PAGE_SIZE); // fresh query -> collapse both columns again
      setEpCount(PAGE_SIZE);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const { data, isFetching } = useQuery({
    queryKey: ["catalog", "search", term],
    queryFn: () => searchShows(term),
    enabled: term.length >= MIN_QUERY_LENGTH,
    placeholderData: (prev) => prev, // keep old results while retyping
  });

  const topResult = data?.shows[0];

  return (
    <main className="mx-auto w-full max-w-2xl p-4 pb-40 sm:p-8 sm:pb-40">
      <h1 className="mb-4 text-2xl font-bold">Search</h1>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Find a podcast… results appear as you type"
        autoFocus
        className="mb-6 w-full rounded-xl border border-zinc-300 px-4 py-2 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
      />

      {!term && (
        <p className="text-zinc-500">
          Find any show — try a name, a topic, or 中文. Click a result to hear
          a 30-second clip.
        </p>
      )}
      {isFetching && <p className="mb-3 text-sm text-zinc-400">Searching…</p>}
      {data?.degraded && (
        <p className="text-zinc-500">
          Search is unavailable right now — try again in a bit.
        </p>
      )}
      {term && data && !data.degraded && data.shows.length === 0 && (
        <p className="text-zinc-500">No shows found for “{term}”.</p>
      )}

      {/* Shows and Episodes side by side — scan both at a glance */}
      {data && (data.shows.length > 0 || data.episodes.length > 0) && (
        <div className="grid items-start gap-8 md:grid-cols-2">
          <section>
            <h2 className="font-brand mb-3 text-xs font-bold uppercase tracking-[0.22em] text-zinc-800 dark:text-zinc-100">
              Shows
            </h2>
            <ul className="flex flex-col gap-3">
              {data.shows.slice(0, showCount).map((show) => (
                <ShowRow key={show.id} show={show} />
              ))}
            </ul>
            {data.shows.length > showCount && (
              <MoreButton
                label="More shows"
                onClick={() => setShowCount((n) => n + PAGE_SIZE)}
              />
            )}
          </section>

          <section>
            <h2 className="font-brand mb-3 text-xs font-bold uppercase tracking-[0.22em] text-zinc-800 dark:text-zinc-100">
              Episodes
            </h2>
            {data.episodes.length === 0 ? (
              <p className="text-sm text-zinc-500">No matching episodes.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {data.episodes.slice(0, epCount).map((ep) => (
                  <EpisodeRow key={ep.id} episode={ep} />
                ))}
              </ul>
            )}
            {data.episodes.length > epCount && (
              <MoreButton
                label="More episodes"
                onClick={() => setEpCount((n) => n + PAGE_SIZE)}
              />
            )}
          </section>
        </div>
      )}

      {topResult && !data?.degraded && (
        <div className="mt-10">
          <SimilarContent showId={topResult.id} seedTitle={topResult.title} />
        </div>
      )}
    </main>
  );
}

function MoreButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-brand mt-3 w-full rounded-pill border border-surface-border bg-surface px-4 py-2 text-xs uppercase tracking-wider text-zinc-700 transition-colors hover:text-foreground dark:text-zinc-200"
    >
      {label} ↓
    </button>
  );
}

/** A matching episode with one-click "Later" to queue it into the Library. */
function EpisodeRow({ episode }: { episode: CatalogEpisode }) {
  const queryClient = useQueryClient();
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void isEpisodeSaved(episode.id).then((v) => {
      if (!cancelled) setQueued(v);
    });
    return () => {
      cancelled = true;
    };
  }, [episode.id]);

  // ONE_CLICK: a single tap queues (or un-queues) the episode for later.
  function toggleLater() {
    const next = !queued;
    setQueued(next);
    void (next ? saveEpisode(episode) : removeEpisode(episode.id)).then(() =>
      queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] }),
    );
  }

  return (
    <li>
      <PlayableCard
        onPlay={() => previewEpisode(episode)}
        playLabel={`Preview ${episode.title}`}
        className="cursor-pointer gap-4"
      >
        <CoverTile src={episode.coverUrl} size={56} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{episode.title}</p>
          {episode.showTitle &&
            (episode.showId ? (
              // into the show: details, top episodes, similar — one tap away
              <Link
                href={`/show/${episode.showId}`}
                className="relative z-10 block truncate text-sm text-zinc-500 hover:text-accent hover:underline underline-offset-2 dark:text-zinc-400"
              >
                {episode.showTitle} →
              </Link>
            ) : (
              <p className="truncate text-sm text-zinc-500">{episode.showTitle}</p>
            ))}
          <p className="truncate text-xs text-zinc-400">▶ Click for a 30s clip</p>
        </div>
        <Chip
          active={queued}
          onClick={() => toggleLater()}
          className="relative z-10 shrink-0"
        >
          {queued ? "Queued ✓" : "+ Later"}
        </Chip>
      </PlayableCard>
    </li>
  );
}

function ShowRow({ show }: { show: CatalogShow }) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void isSaved(show.id).then((v) => {
      if (!cancelled) setSaved(v);
    });
    return () => {
      cancelled = true;
    };
  }, [show.id]);

  // ONE_CLICK invariant: a single click saves or unsaves (optimistic).
  function toggleSave() {
    const next = !saved;
    setSaved(next);
    void (next ? saveShow(show) : unsaveShow(show.id)).then(() =>
      queryClient.invalidateQueries({ queryKey: ["saved"] }),
    );
  }

  return (
    <li>
      <PlayableCard
        onPlay={() => previewShow(show)}
        playLabel={`Preview ${show.title}`}
        className="cursor-pointer gap-4"
      >
        <CoverTile src={show.coverUrl} size={64} />
        <div className="min-w-0 flex-1">
          {/* the title IS the door into the show — details + top episodes */}
          <Link
            href={`/show/${show.id}`}
            className="relative z-10 block truncate font-semibold hover:text-accent hover:underline underline-offset-2"
          >
            {show.title}
          </Link>
          <p className="truncate text-sm text-zinc-500">{show.author}</p>
          <p className="truncate text-xs text-zinc-400">▶ Click for a 30s clip</p>
        </div>
        <Chip
          active={saved}
          onClick={() => toggleSave()}
          className="relative z-10 shrink-0"
        >
          {saved ? "Saved ✓" : "Save"}
        </Chip>
      </PlayableCard>
    </li>
  );
}
