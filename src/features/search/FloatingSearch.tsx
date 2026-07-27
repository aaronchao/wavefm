"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { sortSearchShows } from "@/src/core/searchSort";
import { searchShows } from "@/src/data/catalog/client";
import { usePlayerState } from "@/src/state/player";
import { SearchEpisodeRow, SearchShowRow } from "./rows";

/**
 * Global search as a floating bar fixed to the bottom of the Discovery,
 * Library, and Show Detail views. Typing expands a results panel upward —
 * Shows (relevance, then newest) and Episodes, each one-click save/queue —
 * without leaving the page. Locks background scroll while open so touch
 * scrolling only moves the results, and offers "View all results" into the
 * dedicated /search page for a fuller view.
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

  // lock the background body scroll while the popup is open — only the
  // results panel scrolls, so the page underneath never fights the touch
  const showResults = open && term.length >= MIN_QUERY_LENGTH;
  useEffect(() => {
    if (!showResults) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showResults]);

  const { data, isFetching } = useQuery({
    queryKey: ["catalog", "search", term],
    queryFn: () => searchShows(term),
    enabled: term.length >= MIN_QUERY_LENGTH,
    placeholderData: (prev) => prev,
  });

  const allShows = sortSearchShows(data?.shows ?? [], term);
  const shows = allShows.slice(0, RESULT_CAP);
  const episodes = data?.episodes.slice(0, RESULT_CAP) ?? [];
  const hasMore = allShows.length > RESULT_CAP || (data?.episodes.length ?? 0) > RESULT_CAP;

  // The Play bar (when visible) sits just above the tab bar and is tall
  // enough to physically overlap this bar's old fixed position — not just a
  // z-index fight. Lift the whole search bar clear above it instead.
  const playerVisible = usePlayerState().status !== "idle";
  const bottomOffset = playerVisible
    ? "calc(env(safe-area-inset-bottom) + 12.5rem)"
    : "calc(env(safe-area-inset-bottom) + 3.5rem)";

  return (
    <div
      ref={rootRef}
      // Strictly above the Play bar (z-[45]) and tab bar (z-40) in the
      // stack — the floating Search bar always wins visually.
      className="fixed inset-x-0 z-50 px-4 transition-[bottom] duration-200 sm:px-8"
      style={{ bottom: bottomOffset }}
    >
      <div className="mx-auto w-full max-w-3xl">
        {showResults && (
          // Liquid-glass search popup: translucent + blurred, subtle border.
          // overscroll-contain + its own scroll keeps the page beneath still.
          <div className="mb-2 max-h-[60vh] overflow-y-auto overscroll-contain rounded-[2px] border border-white/30 bg-white/30 p-3 shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-black/30">
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
            {(hasMore || (shows.length > 0 && episodes.length > 0)) && (
              <Link
                href={`/search?q=${encodeURIComponent(term)}`}
                className="font-brand mt-3 block w-full rounded-[2px] border border-foreground bg-foreground px-4 py-2 text-center text-xs uppercase tracking-wider text-background transition-colors hover:bg-background hover:text-foreground"
              >
                View all results →
              </Link>
            )}
          </div>
        )}

        {/* Liquid-glass search bar: translucent + blurred, subtle border.
            Thicker vertical padding gives it real tap-target presence. */}
        <div className="flex items-center gap-2 rounded-[2px] border border-white/30 bg-white/30 px-4 py-3.5 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-black/30">
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
