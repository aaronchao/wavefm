"use client";

import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { getRankedEpisodes, getShow } from "@/src/data/catalog/client";
import { saveEpisode } from "@/src/data/repos/savedEpisodesRepo";
import type { CatalogShow } from "@/src/data/catalog/types";

/**
 * Pulls new episodes of saved shows into the library automatically.
 *
 * This used to live inside the Library's ShowsColumn, which the cover grid
 * replaced — so it was behaviour attached to a *rendering* component, and
 * deleting that list would have silently taken the feature with it. It's a
 * background job, not a view, so it renders nothing and lives on its own.
 *
 * A new episode of a saved show is the same kind of event as a fresh
 * Discovery save (REFINEMENTS.md #13), so it goes through the same
 * saveEpisode path rather than a second parallel mechanism.
 *
 * Capped at 20 shows: each one costs a catalog lookup, and this fires on
 * every Library visit.
 */
export function NewEpisodeWatcher({
  saved,
}: {
  saved: { show: CatalogShow; savedAt: string }[];
}) {
  const queryClient = useQueryClient();
  const watched = saved.slice(0, 20);

  const freshQ = useQueries({
    queries: watched.map((s) => ({
      queryKey: ["catalog", "show", s.show.id],
      queryFn: () => getShow(s.show.id),
      staleTime: 60 * 60 * 1000,
    })),
  });

  // A primitive (compared by value, not reference), so the effect re-runs
  // only when the fetched dates actually change, not on every render.
  const freshSignal = freshQ.map((q) => q.data?.lastEpisodeAt ?? "").join(",");
  const autoInboxedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const freshById = new Map(freshQ.filter((q) => q.data).map((q) => [q.data!.id, q.data!]));
    for (const { show, savedAt } of watched) {
      const latest = freshById.get(show.id)?.lastEpisodeAt ?? show.lastEpisodeAt;
      if (!latest || Date.parse(latest) <= Date.parse(savedAt)) continue;
      const key = `${show.id}:${latest}`;
      if (autoInboxedRef.current.has(key)) continue;
      autoInboxedRef.current.add(key);
      void getRankedEpisodes(show.id).then((episodes) => {
        const newOnes = episodes.filter(
          (e) => e.publishedAt && Date.parse(e.publishedAt) > Date.parse(savedAt),
        );
        if (newOnes.length === 0) return;
        void Promise.all(
          newOnes.map((e) =>
            saveEpisode({
              id: e.id,
              title: e.title,
              showId: show.id,
              showTitle: show.title,
              coverUrl: show.coverUrl,
              appleUrl: show.appleUrl,
              audioUrl: e.audioUrl,
              durationSec: e.durationSec,
              categories: [],
            }),
          ),
        ).then(() => queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] }));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- freshSignal is the intentional trigger
  }, [freshSignal]);

  return null;
}
