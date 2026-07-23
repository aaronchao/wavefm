"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { CatalogEpisode } from "@/src/data/catalog/types";
import {
  isEpisodeSaved,
  removeEpisode,
  saveEpisode,
} from "@/src/data/repos/savedEpisodesRepo";
import { CoverPlay } from "@/src/features/player/CoverPlay";
import { previewEpisode } from "@/src/features/player/preview";
import { NothingToggle, SettleIn } from "@/src/ui";
import { MachineLabel } from "./DiscoverPage";
import { useInterestEpisodes } from "./useInterestEpisodes";

/**
 * The selected-tag feed: the latest trending EPISODES related to the tapped
 * "For You" interest — not shows. Each row's cover carries the play triangle
 * (routes through the app-wide Play Bar) and can be queued for Later in one
 * tap; the title links to its show. Replaces the ranked-shows list whenever a
 * tag is active.
 */
export function TopicEpisodes({ topic }: { topic: string }) {
  const { episodes, isLoading } = useInterestEpisodes([topic], { perTerm: 20 });

  return (
    <section className="mb-12">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Latest in {topic}</h2>
        <MachineLabel>episodes · newest first</MachineLabel>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-card bg-surface" />
          ))}
        </div>
      ) : episodes.length === 0 ? (
        <p className="rounded-card border border-surface-border bg-surface px-4 py-8 text-center text-sm text-zinc-500">
          No episodes surfaced for “{topic}” right now — try another tag.
        </p>
      ) : (
        <ol className="flex flex-col gap-2.5">
          {episodes.slice(0, 12).map((ep, i) => (
            <SettleIn key={ep.id} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
              <TopicEpisodeRow ep={ep} />
            </SettleIn>
          ))}
        </ol>
      )}
    </section>
  );
}

function TopicEpisodeRow({ ep }: { ep: CatalogEpisode }) {
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
          showId: ep.showId,
          showTitle: ep.showTitle,
          coverUrl: ep.coverUrl,
          appleUrl: ep.appleUrl,
          audioUrl: ep.audioUrl,
          durationSec: ep.durationSec,
          publishedAt: ep.publishedAt,
          categories: [],
        })
      : removeEpisode(ep.id)
    ).then(() => queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] }));
  }

  const when = ep.publishedAt ? freshness(ep.publishedAt) : null;

  return (
    <li className="flex items-start gap-2.5 rounded-card border border-surface-border bg-background p-2.5 shadow-sm">
      <CoverPlay
        src={ep.coverUrl}
        size={48}
        onPlay={() => previewEpisode({ ...ep, categories: ep.categories ?? [] })}
        label={`Play a snippet of ${ep.title}`}
      />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-3 text-sm font-semibold leading-snug">{ep.title}</p>
        {ep.showId ? (
          <Link
            href={`/show/${ep.showId}`}
            className="line-clamp-1 text-xs text-zinc-500 hover:text-accent dark:text-zinc-400"
          >
            {ep.showTitle ?? "Open show"} →
          </Link>
        ) : (
          ep.showTitle && (
            <p className="line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">{ep.showTitle}</p>
          )
        )}
        {when && <p className="line-clamp-1 text-[11px] text-zinc-400">{when}</p>}
      </div>
      <NothingToggle
        active={queued}
        onClick={() => toggleLater()}
        ariaLabel={queued ? `Remove ${ep.title} from Later` : `Save ${ep.title} for later`}
        className="shrink-0 !px-2"
      >
        {queued ? "✓" : "+"}
      </NothingToggle>
    </li>
  );
}

function freshness(publishedAt: string): string {
  const days = Math.floor((Date.now() - Date.parse(publishedAt)) / 86_400_000);
  if (Number.isNaN(days)) return "";
  if (days <= 1) return "Fresh today";
  if (days <= 7) return "New this week";
  if (days <= 30) return "New this month";
  return "Popular episode";
}
