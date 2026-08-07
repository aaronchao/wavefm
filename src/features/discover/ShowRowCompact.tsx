"use client";

import Link from "next/link";
import type { SimilarShow } from "@/src/data/catalog/types";
import { CoverPlay } from "@/src/features/player/CoverPlay";
import { previewShowTopEpisodeMiddle } from "@/src/features/player/preview";
import { NothingToggle } from "@/src/ui";
import { Evidence } from "./Evidence";
import { useSavedToggle } from "./useSavedToggle";

/**
 * A dense, single-row show card for the side-by-side columns (Charts + the
 * ranked list). Two-line clamps instead of hard truncation so a title and its
 * reason stay readable in a narrow column. The cover carries the embedded
 * play triangle (tap = play the talked-about bit, in the app-wide Play Bar);
 * the title text is the separate door into the show. Kept deliberately
 * light — no inline episode expander — so two of these columns fit on one
 * screen.
 *
 * `glass`: opt-in "Liquid Glass" treatment (same translucent+blurred recipe
 * as the search overlay's already-established look) — a Discover-only visual
 * prototype, so this defaults off and is only passed `true` from Discover's
 * own call sites (RankedRecs, Charts). The Show-detail page reuses this same
 * component (SimilarContent, CommunityRecs) and deliberately keeps the
 * plain card look until/unless the prototype is approved to spread further.
 */
export function ShowRowCompact({ show, glass = false }: { show: SimilarShow; glass?: boolean }) {
  const saved = useSavedToggle(show);
  return (
    <li
      className={`flex items-start gap-2.5 rounded-card p-2.5 ${
        glass ? "glass-panel shadow-md" : "border border-surface-border bg-background shadow-sm"
      }`}
    >
      <CoverPlay
        src={show.coverUrl}
        size={48}
        onPlay={() => previewShowTopEpisodeMiddle(show)}
        label={`Play the most-discussed bit of ${show.title}`}
      />
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
      <NothingToggle
        active={saved.saved}
        onClick={saved.toggle}
        ariaLabel={saved.saved ? "Saved ✓" : "Save"}
        className="shrink-0 !px-2"
      >
        {saved.saved ? "✓" : "+"}
      </NothingToggle>
    </li>
  );
}
