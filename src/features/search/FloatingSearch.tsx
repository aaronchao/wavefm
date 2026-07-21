"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { searchShows } from "@/src/data/catalog/client";
import { SearchEpisodeRow, SearchShowRow } from "./rows";

/**
 * Global search as a floating bar fixed to the bottom of the Discovery and
 * Library views (Search is no longer a tab). Typing expands a results panel
 * upward — Shows and Episodes, each one-click save/queue — without leaving
 * the page. Sits just above the bottom tab bar and honours the mobile safe
 * area so the keyboard / home indicator never overlaps it.
 */

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;
const RESULT_CAP = 6;

export function FloatingSearch() {
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const next = input.trim();
    const timer = setTimeout(() => {
      setTerm(next.length >= MIN_QUERY_LENGTH ? next : "");
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  // tap outside to dismiss the results panel (keeps the bar itself in place)
  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const { data, isFetching } = useQuery({
    queryKey: ["catalog", "search", term],
    queryFn: () => searchShows(term),
    enabled: term.length >= MIN_QUERY_LENGTH,
    placeholderData: (prev) => prev,
  });

  const showResults = open && term.length >= MIN_QUERY_LENGTH;
  const shows = data?.shows.slice(0, RESULT_CAP) ?? [];
  const episodes = data?.episodes.slice(0, RESULT_CAP) ?? [];

  return (
    <div
      ref={rootRef}
      // Strictly above the Play bar (z-[45]) and tab bar (z-40) in the
      // stack — the floating Search bar always wins visually.
      className="fixed inset-x-0 z-50 px-4 sm:px-8"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 3.5rem)" }}
    >
      <div className="mx-auto w-full max-w-3xl">
        {showResults && (
          // Liquid-glass search popup: translucent + blurred, subtle border
          <div className="mb-2 max-h-[60vh] overflow-y-auto rounded-[2px] border border-white/30 bg-white/30 p-3 shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-black/30">
            {isFetching && shows.length === 0 && episodes.length === 0 && (
              <p className="px-1 py-3 text-sm text-zinc-400">Searching…</p>
            )}
            {data?.degraded && (
              <p className="px-1 py-3 text-sm text-zinc-500">
                Search is unavailable right now — try again in a bit.
              </p>
            )}
            {data && !data.degraded && shows.length === 0 && episodes.length === 0 && !isFetching && (
              <p className="px-1 py-3 text-sm text-zinc-500">No results for “{term}”.</p>
            )}
            <div className="grid items-start gap-5 md:grid-cols-2">
              {shows.length > 0 && (
                <section>
                  <PanelLabel>Shows</PanelLabel>
                  <ul className="flex flex-col gap-2">
                    {shows.map((show) => (
                      <SearchShowRow key={show.id} show={show} />
                    ))}
                  </ul>
                </section>
              )}
              {episodes.length > 0 && (
                <section>
                  <PanelLabel>Episodes</PanelLabel>
                  <ul className="flex flex-col gap-2">
                    {episodes.map((ep) => (
                      <SearchEpisodeRow key={ep.id} episode={ep} />
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        )}

        {/* Liquid-glass search bar: translucent + blurred, subtle border */}
        <div className="flex items-center gap-2 rounded-[2px] border border-white/30 bg-white/30 px-3 py-2 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-black/30">
          <SearchIcon className="h-4 w-4 shrink-0 text-foreground" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder="SEARCH PODCASTS · 搜索播客"
            aria-label="Search podcasts"
            className="font-brand min-w-0 flex-1 bg-transparent text-sm uppercase tracking-wider text-foreground placeholder:text-zinc-400 focus:outline-none"
          />
          {input && (
            <button
              type="button"
              onClick={() => {
                setInput("");
                setTerm("");
              }}
              aria-label="Clear search"
              className="shrink-0 rounded-full px-1 text-zinc-400 hover:text-foreground"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-brand mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-800 dark:text-zinc-100">
      {children}
    </h3>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}
