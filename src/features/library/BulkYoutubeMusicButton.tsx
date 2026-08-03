"use client";

import { useState } from "react";
import { youtubeMusicAddByRssUrl } from "@/src/core/links";
import { listSaved } from "@/src/data/repos/savedShowsRepo";

type Item = { id: string; title: string; url: string };

/**
 * YouTube Music has no bulk/OPML import — its real add-by-RSS deep link
 * (src/core/links.ts) only ever adds one show per open, with its own
 * confirmation inside YouTube Music each time. There's no way around that
 * from a web app (no bulk API, and browsers block auto-opening several
 * tabs from one click anyway). This is the honest version of "bulk add":
 * one list of every saved show with a known feed, each a direct tap-through
 * to that show's add-by-RSS link, with a checkmark so a click-through
 * session is easy to resume without re-scanning the whole Library.
 */
export function BulkYoutubeMusicButton() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  async function open() {
    setLoading(true);
    try {
      const saved = await listSaved();
      setItems(
        saved
          .filter((s) => s.show.feedUrl)
          .map((s) => ({
            id: s.show.id,
            title: s.show.title,
            url: youtubeMusicAddByRssUrl(s.show.feedUrl!),
          })),
      );
      setDone(new Set());
    } finally {
      setLoading(false);
    }
  }

  if (items === null) {
    return (
      <button
        type="button"
        onClick={() => void open()}
        disabled={loading}
        title="List every saved show with a one-tap YouTube Music add-by-RSS link"
        className="rounded-pill border border-surface-border bg-surface px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-zinc-500 transition-colors hover:text-foreground disabled:opacity-50"
      >
        {loading ? "Loading…" : "Bulk add to YouTube Music"}
      </button>
    );
  }

  return (
    <div className="mb-4 rounded-[2px] border border-dashed border-surface-border p-3 text-xs text-zinc-500">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-brand uppercase tracking-wider text-zinc-800 dark:text-zinc-100">
          Add to YouTube Music
        </span>
        <button
          type="button"
          onClick={() => setItems(null)}
          className="text-zinc-400 underline hover:text-foreground"
        >
          Close
        </button>
      </div>
      {items.length === 0 ? (
        <p>No saved shows with a known feed yet.</p>
      ) : (
        <>
          <p className="mb-2">
            {
              "YouTube Music adds one show per tap and confirms it itself — tap each below once (opens in a new tab); a check marks the ones you've done."
            }
          </p>
          <ul className="flex flex-col gap-1">
            {items.map((it) => (
              <li key={it.id}>
                <a
                  href={it.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setDone((d) => new Set(d).add(it.id))}
                  className={`hover:text-accent hover:underline ${
                    done.has(it.id) ? "text-accent" : "text-foreground/80"
                  }`}
                >
                  {done.has(it.id) ? "✓ " : ""}
                  {it.title}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
