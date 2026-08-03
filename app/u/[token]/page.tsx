"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getSharedQueue, type SharedQueueEpisode } from "@/src/data/repos/shareRepo";
import { OpenInLinks } from "@/src/features/library/OpenInLinks";
import { CoverPlay } from "@/src/features/player/CoverPlay";
import { previewEpisode } from "@/src/features/player/preview";
import { PlayableCard } from "@/src/ui";

/**
 * Public "share your Queue" page (§11 override, explicitly approved —
 * normally deferred). Read-only: a visitor can preview and open-in-app,
 * never save/reorder/archive — those actions belong to an owner's own
 * Library, not a link anyone with the URL can load. Deliberately shows
 * no name/email/account detail, only what was queued.
 */
export default function SharedQueuePage() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["share", token],
    queryFn: () => getSharedQueue(token),
  });

  return (
    <main className="mx-auto w-full max-w-2xl p-4 pb-16 sm:p-8">
      <div className="mb-6 border-b border-surface-border pb-3">
        <h1 className="font-brand text-xl font-bold tracking-tight sm:text-2xl">
          A Shared Queue
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Someone&apos;s curated listen-later list, via{" "}
          <Link href="/" className="text-accent hover:underline">
            WaveFM
          </Link>
          .
        </p>
      </div>

      {isLoading && <p className="text-zinc-500">Loading…</p>}
      {!isLoading && !data && (
        <p className="text-zinc-500">
          This link isn&apos;t active — sharing may have been turned off.
        </p>
      )}
      {data && data.episodes.length === 0 && (
        <p className="text-zinc-500">Nothing queued yet.</p>
      )}
      {data && data.episodes.length > 0 && (
        <ul className="flex flex-col gap-3">
          {data.episodes.map((e) => (
            <SharedEpisodeRow key={e.id} episode={e} />
          ))}
        </ul>
      )}
    </main>
  );
}

function SharedEpisodeRow({ episode }: { episode: SharedQueueEpisode }) {
  const play = () =>
    previewEpisode({
      id: episode.id,
      title: episode.title,
      showId: episode.showId,
      showTitle: episode.showTitle,
      coverUrl: episode.coverUrl,
      appleUrl: episode.appleUrl,
      audioUrl: episode.audioUrl,
      durationSec: episode.durationSec,
      categories: [],
    });

  return (
    <li>
      <PlayableCard onPlay={play} playLabel={`Preview ${episode.title}`} className="!rounded-[2px]">
        <CoverPlay
          src={episode.coverUrl}
          size={56}
          onPlay={play}
          label={`Play a snippet of ${episode.title}`}
          className="relative z-10 !rounded-[2px]"
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-semibold leading-snug">{episode.title}</p>
          {episode.showTitle && (
            <p className="line-clamp-1 text-sm text-zinc-500 dark:text-zinc-400">
              {episode.showTitle}
            </p>
          )}
          <OpenInLinks
            title={episode.showTitle ? `${episode.showTitle} ${episode.title}` : episode.title}
            showTitle={episode.showTitle}
            appleUrl={episode.appleUrl}
            showId={episode.showId}
            className="relative z-10 mt-1.5"
          />
        </div>
      </PlayableCard>
    </li>
  );
}
