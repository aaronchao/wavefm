"use client";

import Link from "next/link";
import type { SimilarShow } from "@/src/data/catalog/types";
import { previewShowTopEpisodeMiddle } from "@/src/features/player/preview";
import { Chip, CoverTile, SettleIn } from "@/src/ui";
import { MachineLabel } from "./DiscoverPage";
import { EpisodeList } from "./EpisodeList";
import { Evidence } from "./Evidence";
import { useSavedToggle } from "./useSavedToggle";

/**
 * The ranked recommendation list (everything after the For-You hero),
 * ordered top to bottom; each row opens into its episodes. The hero and
 * the shared query live one level up so charts can sit between them.
 */
export function RankedRecs({
  rest,
  count,
  topic,
  topicApplied,
  isLoading,
}: {
  rest: SimilarShow[];
  count: number;
  topic: string | null;
  topicApplied: boolean;
  isLoading: boolean;
}) {
  if (isLoading) return <SkeletonRows />;
  if (count === 0) {
    return (
      <p className="mb-12 rounded-card border border-surface-border bg-surface px-4 py-8 text-center text-sm text-zinc-500">
        Recommendations are quiet right now — save a show or two and they’ll
        wake up.
      </p>
    );
  }
  if (rest.length === 0) return null; // only the hero survived; nothing more to list

  return (
    <section className="mb-12">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">
          {topicApplied ? `More in ${topic}` : "More ranked for you"}
        </h2>
        <MachineLabel>{count} shows</MachineLabel>
      </div>
      <ol className="flex flex-col gap-3">
        {rest.map((pick, i) => (
          <SettleIn key={pick.id} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
            <RankedRow pick={pick} rank={i + 2} />
          </SettleIn>
        ))}
      </ol>
    </section>
  );
}

/** One ranked recommendation, openable into its episodes. */
export function RankedRow({ pick, rank }: { pick: SimilarShow; rank: number }) {
  const saved = useSavedToggle(pick);
  return (
    <li className="rounded-card border border-surface-border bg-background p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="w-8 shrink-0 text-center font-mono text-lg font-bold tabular-nums text-zinc-300 dark:text-zinc-600">
          {String(rank).padStart(2, "0")}
        </span>
        <Link href={`/show/${pick.id}`} className="shrink-0" aria-label={`Open ${pick.title}`}>
          <CoverTile src={pick.coverUrl} size={56} />
        </Link>
        <div className="min-w-0 flex-1">
          {/* the title IS the door into the show — episodes, links, similar */}
          <Link
            href={`/show/${pick.id}`}
            className="block truncate font-semibold hover:text-accent hover:underline underline-offset-2"
          >
            {pick.title}
          </Link>
          <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{pick.author}</p>
          <Evidence show={pick} className="mt-1" />
        </div>
        <button
          type="button"
          onClick={() => previewShowTopEpisodeMiddle(pick)}
          aria-label={`Play the most-discussed bit of ${pick.title}`}
          className="shrink-0 rounded-full bg-accent px-3 py-2 text-sm font-semibold text-white transition-transform active:scale-95"
        >
          ▶
        </button>
        <Chip active={saved.saved} onClick={saved.toggle} className="shrink-0">
          {saved.saved ? "✓" : "Save"}
        </Chip>
      </div>
      <EpisodeList show={pick} />
    </li>
  );
}

function SkeletonRows() {
  return (
    <section className="mb-12 animate-pulse">
      <div className="mb-4 h-6 w-40 rounded bg-surface" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 rounded-card bg-surface" />
        ))}
      </div>
    </section>
  );
}
