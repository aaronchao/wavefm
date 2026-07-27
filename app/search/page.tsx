"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { sortSearchShows } from "@/src/core/searchSort";
import { searchShows } from "@/src/data/catalog/client";
import { SearchEpisodeRow, SearchShowRow } from "@/src/features/search/rows";

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
  // relevance (exact/prefix match) first, then newest — no listen counts
  // are available from the catalog APIs, so this is the honest ranking
  const rankedShows = data ? sortSearchShows(data.shows, term) : [];

  return (
    <main className="mx-auto w-full max-w-5xl p-4 pb-40 sm:p-8 sm:pb-40">
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
              {rankedShows.slice(0, showCount).map((show) => (
                <SearchShowRow key={show.id} show={show} />
              ))}
            </ul>
            {rankedShows.length > showCount && (
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
                  <SearchEpisodeRow key={ep.id} episode={ep} />
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
