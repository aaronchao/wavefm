"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { searchShows } from "@/src/data/catalog/client";
import type { CatalogShow } from "@/src/data/catalog/types";
import { isSaved, saveShow, unsaveShow } from "@/src/data/repos/savedShowsRepo";

export default function SearchPage() {
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");

  const { data, isFetching } = useQuery({
    queryKey: ["catalog", "search", term],
    queryFn: () => searchShows(term),
    enabled: term.length > 0,
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTerm(input.trim());
  }

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-8">
      <h1 className="mb-4 text-2xl font-bold">Search</h1>
      <form onSubmit={onSubmit} className="mb-6 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Find a podcast…"
          className="w-full rounded-xl border border-zinc-300 px-4 py-2 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          className="rounded-xl bg-zinc-900 px-4 py-2 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Search
        </button>
      </form>

      {isFetching && <p className="text-zinc-500">Searching…</p>}
      {data?.degraded && (
        <p className="text-zinc-500">
          Search is unavailable right now — try again in a bit.
        </p>
      )}
      {data && !data.degraded && data.shows.length === 0 && (
        <p className="text-zinc-500">No shows found for “{term}”.</p>
      )}

      <ul className="flex flex-col gap-3">
        {data?.shows.map((show) => (
          <ShowRow key={show.id} show={show} />
        ))}
      </ul>
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
    <li className="flex items-center gap-4 rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
      {show.coverUrl ? (
        // arbitrary external art hosts; skip Vercel image optimization (Hobby quota)
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={show.coverUrl}
          alt=""
          width={64}
          height={64}
          loading="lazy"
          className="h-16 w-16 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div className="h-16 w-16 shrink-0 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{show.title}</p>
        <p className="truncate text-sm text-zinc-500">{show.author}</p>
        {show.categories.length > 0 && (
          <p className="truncate text-xs text-zinc-400">
            {show.categories.slice(0, 3).join(" · ")}
          </p>
        )}
      </div>
      <button
        onClick={toggleSave}
        aria-pressed={saved}
        className={`shrink-0 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
          saved
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
            : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200"
        }`}
      >
        {saved ? "Saved ✓" : "Save"}
      </button>
    </li>
  );
}
