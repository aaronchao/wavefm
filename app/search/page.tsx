"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { searchShows } from "@/src/data/catalog/client";
import type { CatalogShow } from "@/src/data/catalog/types";
import { isSaved, saveShow, unsaveShow } from "@/src/data/repos/savedShowsRepo";
import { previewShow } from "@/src/features/player/preview";
import { SimilarContent } from "@/src/features/show/SimilarContent";
import { Chip, CoverTile, PlayableCard } from "@/src/ui";

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;

export default function SearchPage() {
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");

  // live search: results appear as you type, no Search click needed
  useEffect(() => {
    const next = input.trim();
    const timer = setTimeout(
      () => setTerm(next.length >= MIN_QUERY_LENGTH ? next : ""),
      DEBOUNCE_MS,
    );
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

      <ul className="flex flex-col gap-3">
        {data?.shows.map((show) => (
          <ShowRow key={show.id} show={show} />
        ))}
      </ul>

      {topResult && !data?.degraded && (
        <div className="mt-10">
          <SimilarContent showId={topResult.id} seedTitle={topResult.title} />
        </div>
      )}
    </main>
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
          <p className="truncate font-semibold">{show.title}</p>
          <p className="truncate text-sm text-zinc-500">{show.author}</p>
          <p className="truncate text-xs text-zinc-400">
            ▶ Click for a 30s clip
            {show.categories.length > 0 &&
              ` · ${show.categories.slice(0, 3).join(" · ")}`}
          </p>
        </div>
        <Link
          href={`/show/${show.id}`}
          className="relative z-10 shrink-0 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Details →
        </Link>
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
