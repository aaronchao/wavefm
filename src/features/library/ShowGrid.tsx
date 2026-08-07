"use client";

import Link from "next/link";
import type { CatalogShow } from "@/src/data/catalog/types";

/**
 * Saved shows as a grid of covers — the top of the Library, and on a phone
 * the only thing above the fold.
 *
 * The Library previously opened with paragraphs of copy, three sync panels
 * and a tag rail before any of the user's own content: screens of text to
 * scroll past on mobile to reach the thing they came for. Artwork is how
 * people actually recognise a podcast, so covers carry the recognition and
 * the title is a single clamped line under it rather than a block of
 * metadata. Author, categories and counts are all dropped here — they're on
 * the show's own page, one tap away.
 *
 * Four across on a phone deliberately: three is the common default but
 * leaves a saved library of ~20 shows needing a scroll, and at this size the
 * cover is still perfectly recognisable.
 */
export function ShowGrid({
  saved,
  loading,
  filtered,
}: {
  saved: { show: CatalogShow; savedAt: string }[];
  loading: boolean;
  filtered: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-tile bg-surface-border/40" />
        ))}
      </div>
    );
  }

  if (saved.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        {filtered ? "No shows with this tag." : "No shows saved yet — find some in Discovery."}
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6">
      {saved.map(({ show }) => (
        <li key={show.id}>
          <Link href={`/show/${show.id}`} className="group block" title={show.title}>
            {/* CoverTile takes fixed pixel dimensions, which can't fill a
                responsive grid cell — so the image is inline here rather
                than reshaping a primitive every other call site depends on. */}
            <div className="glass-card glass-card-interactive aspect-square w-full overflow-hidden rounded-tile">
              {show.coverUrl ? (
                // arbitrary external art hosts; skip Vercel image optimization
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={show.coverUrl}
                  alt=""
                  loading="lazy"
                  className="h-full w-full rounded-tile object-cover"
                />
              ) : (
                <div className="h-full w-full rounded-tile bg-surface" />
              )}
            </div>
            <p className="mt-1.5 line-clamp-1 text-[11px] leading-tight text-muted-foreground transition-colors group-hover:text-foreground">
              {show.title}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
