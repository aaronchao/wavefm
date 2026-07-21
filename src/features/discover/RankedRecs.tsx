"use client";

import { useQueries, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getRankedEpisodes } from "@/src/data/catalog/client";
import type { RankedEpisodeItem, SimilarShow } from "@/src/data/catalog/types";
import {
  isEpisodeSaved,
  removeEpisode,
  saveEpisode,
} from "@/src/data/repos/savedEpisodesRepo";
import { previewRankedEpisode } from "@/src/features/player/preview";
import { NothingToggle, PlayButton, SettleIn } from "@/src/ui";
import { MachineLabel } from "./DiscoverPage";
import { ShowRowCompact } from "./ShowRowCompact";

/** How many top shows we pull episodes from for the Episodes column. */
const EP_SHOWS = 6;
const BASIS_LABEL: Record<RankedEpisodeItem["basis"], string> = {
  listens: "Most listened",
  discussion: "Discussed",
  rating: "Rated",
  recent: "Recent",
};

/**
 * The ranked recommendations below the For-You hero — now Shows | Episodes
 * side by side, matching the Charts and Search layouts. The left column ranks
 * the shows (each a door into its page); the right column surfaces one
 * talked-about episode from each of the top shows, playable and queueable in a
 * tap. The hero and shared query live one level up so Charts can sit between.
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
      <div className="grid items-start gap-8 md:grid-cols-2">
        <section>
          <ColumnLabel>Shows</ColumnLabel>
          <ol className="flex flex-col gap-2.5">
            {rest.map((pick, i) => (
              <SettleIn key={pick.id} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
                <ShowRowCompact show={pick} rank={i + 2} />
              </SettleIn>
            ))}
          </ol>
        </section>
        <section>
          <ColumnLabel>Episodes to try</ColumnLabel>
          <EpisodesColumn shows={rest} />
        </section>
      </div>
    </section>
  );
}

function ColumnLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-brand mb-3 text-xs font-bold uppercase tracking-[0.22em] text-zinc-800 dark:text-zinc-100">
      {children}
    </h3>
  );
}

/**
 * The Episodes column: one talked-about episode from each of the top ranked
 * shows, flattened into a single readable list. Best-effort — a show whose
 * feed can't be ranked simply contributes nothing.
 */
function EpisodesColumn({ shows }: { shows: SimilarShow[] }) {
  const top = shows.slice(0, EP_SHOWS);
  const results = useQueries({
    queries: top.map((s) => ({
      queryKey: ["catalog", "episodes-ranked", s.id],
      queryFn: () => getRankedEpisodes(s.id),
      staleTime: 6 * 60 * 60 * 1000,
    })),
  });

  const rows = results
    .map((r, i) => ({ ep: r.data?.[0], show: top[i] }))
    .filter((r): r is { ep: RankedEpisodeItem; show: SimilarShow } => Boolean(r.ep));
  const stillLoading = results.some((r) => r.isLoading);

  if (stillLoading && rows.length === 0) {
    return (
      <div className="flex flex-col gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-card bg-surface" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="rounded-card border border-surface-border bg-surface px-3 py-6 text-center text-xs text-zinc-500">
        Open a show on the left to hear its episodes.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-2.5">
      {rows.map(({ ep, show }, i) => (
        <SettleIn key={`${show.id}:${ep.id}`} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
          <EpisodeColumnRow ep={ep} show={show} />
        </SettleIn>
      ))}
    </ol>
  );
}

function EpisodeColumnRow({ ep, show }: { ep: RankedEpisodeItem; show: SimilarShow }) {
  const queryClient = useQueryClient();
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void isEpisodeSaved(ep.id).then((v) => !cancelled && setQueued(v));
    return () => {
      cancelled = true;
    };
  }, [ep.id]);

  // ONE_CLICK: queue this episode straight into the Library
  function toggleLater() {
    const next = !queued;
    setQueued(next);
    void (next
      ? saveEpisode({
          id: ep.id,
          title: ep.title,
          showId: show.id,
          showTitle: show.title,
          coverUrl: show.coverUrl,
          appleUrl: show.appleUrl,
          audioUrl: ep.audioUrl,
          durationSec: ep.durationSec,
          publishedAt: ep.publishedAt,
          categories: [],
        })
      : removeEpisode(ep.id)
    ).then(() => queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] }));
  }

  return (
    <li className="flex items-start gap-2.5 rounded-card border border-surface-border bg-background p-2.5 shadow-sm">
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">{ep.title}</p>
        <Link
          href={`/show/${show.id}`}
          className="line-clamp-1 text-xs text-zinc-500 hover:text-accent dark:text-zinc-400"
        >
          {show.title} →
        </Link>
        <p className="line-clamp-1 text-[11px] text-zinc-400">
          <span
            className={`font-mono uppercase tracking-wider ${
              ep.basis === "discussion" ? "text-accent" : ""
            }`}
          >
            {BASIS_LABEL[ep.basis]}
          </span>{" "}
          · {ep.why}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <PlayButton
          onClick={() => previewRankedEpisode(ep, show)}
          disabled={!ep.audioUrl}
          label={`Play the middle of ${ep.title}`}
          size="sm"
        />
        <NothingToggle
          active={queued}
          onClick={() => toggleLater()}
          ariaLabel={queued ? `Remove ${ep.title} from Later` : `Save ${ep.title} for later`}
          className="!px-2"
        >
          {queued ? "✓" : "+ Later"}
        </NothingToggle>
      </div>
    </li>
  );
}

function SkeletonRows() {
  return (
    <section className="mb-12 animate-pulse">
      <div className="mb-4 h-6 w-40 rounded bg-surface" />
      <div className="grid gap-8 md:grid-cols-2">
        {[0, 1].map((col) => (
          <div key={col} className="flex flex-col gap-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-card bg-surface" />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
