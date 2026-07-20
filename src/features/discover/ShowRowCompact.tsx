"use client";

import Link from "next/link";
import type { SimilarShow } from "@/src/data/catalog/types";
import { previewShowTopEpisodeMiddle } from "@/src/features/player/preview";
import { Chip, CoverTile } from "@/src/ui";
import { Evidence } from "./Evidence";
import { useSavedToggle } from "./useSavedToggle";

/**
 * A dense, single-row show card for the side-by-side columns (Charts + the
 * ranked list). Two-line clamps instead of hard truncation so a title and its
 * reason stay readable in a narrow column, with the cover, a one-tap play of
 * the talked-about bit, and a one-click save. The title is the door into the
 * show. Kept deliberately light — no inline episode expander — so two of these
 * columns fit on one screen.
 */
export function ShowRowCompact({
  show,
  rank,
}: {
  show: SimilarShow;
  rank: number;
}) {
  const saved = useSavedToggle(show);
  return (
    <li className="flex items-start gap-2.5 rounded-card border border-surface-border bg-background p-2.5 shadow-sm">
      <span className="font-brand mt-0.5 w-5 shrink-0 text-center text-sm font-bold tabular-nums text-zinc-400 dark:text-zinc-500">
        {rank}
      </span>
      <Link href={`/show/${show.id}`} className="shrink-0" aria-label={`Open ${show.title}`}>
        <CoverTile src={show.coverUrl} size={48} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          href={`/show/${show.id}`}
          className="line-clamp-2 font-semibold leading-snug hover:text-accent hover:underline underline-offset-2"
        >
          {show.title}
        </Link>
        {/* Evidence renders the "why" as a tappable pill (+ rating badges). */}
        <Evidence show={show} className="mt-1" />
      </div>
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={() => previewShowTopEpisodeMiddle(show)}
          aria-label={`Play the most-discussed bit of ${show.title}`}
          className="rounded-full bg-accent px-2.5 py-1.5 text-xs font-semibold text-white transition-transform active:scale-95"
        >
          ▶
        </button>
        <Chip active={saved.saved} onClick={saved.toggle} className="!px-2 !py-1 !text-xs">
          {saved.saved ? "✓" : "Save"}
        </Chip>
      </div>
    </li>
  );
}
