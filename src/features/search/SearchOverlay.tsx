"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { sortSearchShows } from "@/src/core/searchSort";
import { searchShows } from "@/src/data/catalog/client";
import { SearchEpisodeRow, SearchShowRow } from "./rows";

/**
 * Global search as a header icon that opens a full-screen overlay.
 *
 * Replaces the old bottom-fixed FloatingSearch bar: three things were
 * competing for the bottom edge (tab bar z-40, Play bar z-45, search bar
 * z-50), and the raised centre Wavr button — which pokes above the tab
 * bar's own top edge — sat exactly under the search bar's fixed offset, so
 * search covered it. That was a per-element offset-tuning fight
 * (`bottomOffset` already had to jump when the player appeared) that would
 * have recurred on the next bottom-UI change. Collapsing to an icon frees
 * the bottom edge entirely instead of re-tuning it.
 *
 * The trigger reuses the header's existing search affordance, so this adds
 * no new chrome. Results open downward from the input (a top-anchored
 * panel reads more naturally than the old upward expansion), and "Open all
 * results" is a persistent row directly under the input rather than a
 * conditional link buried below the results.
 */

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;
const RESULT_CAP = 6;

export function SearchButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="rounded-full p-2 text-zinc-500 transition-colors hover:text-foreground dark:text-zinc-400"
      >
        <SearchIcon className="h-5 w-5" />
      </button>
      {open && <SearchOverlay onClose={() => setOpen(false)} />}
    </>
  );
}

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const next = input.trim();
    const timer = setTimeout(() => {
      setTerm(next.length >= MIN_QUERY_LENGTH ? next : "");
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  // Focus the field as the overlay opens — opening search and then having
  // to tap the input is the friction an icon-collapse would otherwise add.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // The overlay owns the viewport while open; the page beneath must not scroll.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["catalog", "search", term],
    queryFn: () => searchShows(term),
    enabled: term.length >= MIN_QUERY_LENGTH,
    placeholderData: (prev) => prev,
  });

  const allShows = sortSearchShows(data?.shows ?? [], term);
  const allEpisodes = data?.episodes ?? [];
  const shows = allShows.slice(0, RESULT_CAP);
  const episodes = allEpisodes.slice(0, RESULT_CAP);
  const total = allShows.length + allEpisodes.length;
  const searching = term.length >= MIN_QUERY_LENGTH;
  const empty = Boolean(data) && !data?.degraded && total === 0 && !isFetching;

  return (
    // Above the Play bar (z-45) and tab bar (z-40); the overlay owns the screen.
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-surface-border px-4 py-3 sm:px-8">
        <SearchIcon className="h-4 w-4 shrink-0 text-foreground" />
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="SEARCH PODCASTS · 搜索播客"
          aria-label="Search podcasts"
          className="font-brand min-w-0 flex-1 bg-transparent text-sm uppercase tracking-wider text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {input && (
          <button
            type="button"
            onClick={() => {
              setInput("");
              setTerm("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="shrink-0 rounded-full px-1 text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="font-brand shrink-0 pl-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          Close
        </button>
      </div>

      {/* Persistent, top-anchored escape hatch into the full results page —
          visible as soon as there's anything to see, not gated on there
          being *more* than fits, and never below the results. */}
      {searching && total > 0 && (
        <Link
          href={`/search?q=${encodeURIComponent(term)}`}
          onClick={onClose}
          className="font-brand flex items-center justify-between border-b border-surface-border bg-foreground px-4 py-3 text-xs uppercase tracking-wider text-background transition-opacity hover:opacity-90 sm:px-8"
        >
          <span>
            {total} result{total === 1 ? "" : "s"}
          </span>
          <span>Open all results →</span>
        </Link>
      )}

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-8">
        {!searching && (
          <p className="py-3 text-sm text-muted-foreground">
            Type at least {MIN_QUERY_LENGTH} characters to search.
          </p>
        )}
        {searching && isFetching && total === 0 && (
          <p className="py-3 text-sm text-muted-foreground">Searching…</p>
        )}
        {data?.degraded && (
          <p className="py-3 text-sm text-zinc-500">
            Search is unavailable right now — try again in a bit.
          </p>
        )}
        {searching && empty && (
          <p className="py-3 text-sm text-zinc-500">No results for “{term}”.</p>
        )}
        {/* Episodes lead — most searches are chasing a specific episode,
            not browsing shows, so that result should be the first thing
            scanned (and the first thing stacked on mobile). */}
        <div className="mx-auto grid w-full max-w-3xl items-start gap-5 md:grid-cols-2">
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
