"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  recommend,
  SEED_CLUSTERS,
  type Cluster,
  type ShowInput,
} from "@/src/core/recommend";
import { searchShows } from "@/src/data/catalog/client";
import type { CatalogShow } from "@/src/data/catalog/types";
import { listEngagements } from "@/src/data/repos/engagementRepo";
import { getImpressions } from "@/src/data/repos/impressionsRepo";
import { getPrefs } from "@/src/data/repos/prefsRepo";
import { listSaved } from "@/src/data/repos/savedShowsRepo";
import { useSession } from "@/src/state/useSession";

export function toShowInput(show: CatalogShow): ShowInput {
  return {
    id: show.id,
    title: show.title,
    description: show.description,
    categories: show.categories,
  };
}

/**
 * Candidate pool: one catalog search per interest (seed labels when the
 * user hasn't picked yet), unioned and deduped. Cached for hours — the
 * engine itself runs locally per Section 8.7.
 */
async function fetchCandidates(interests: string[]): Promise<CatalogShow[]> {
  const queries = interests.length > 0 ? interests : SEED_CLUSTERS.map((s) => s.label);
  const results = await Promise.all(queries.map((q) => searchShows(q)));
  const byId = new Map<string, CatalogShow>();
  for (const r of results) {
    for (const show of r.shows) {
      if (!byId.has(show.id)) byId.set(show.id, show);
    }
  }
  return [...byId.values()];
}

export type Recommendations = {
  clusters: Cluster[];
  /** id -> full catalog show, for save/like actions on feed cards. */
  showsById: Map<string, CatalogShow>;
  needsOnboarding: boolean;
  isLoading: boolean;
  refresh: () => void;
};

export function useRecommendations(): Recommendations {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const scope = session?.user.id ?? "local";

  const prefsQ = useQuery({ queryKey: ["prefs", scope], queryFn: getPrefs });
  const engagementQ = useQuery({
    queryKey: ["engagement", scope],
    queryFn: listEngagements,
  });
  const savedQ = useQuery({ queryKey: ["saved", scope], queryFn: listSaved });

  const interests = useMemo(() => prefsQ.data?.interests ?? [], [prefsQ.data]);
  const candidatesQ = useQuery({
    queryKey: ["candidates", [...interests].sort().join("|")],
    queryFn: () => fetchCandidates(interests),
    enabled: prefsQ.isSuccess,
    staleTime: 3 * 60 * 60 * 1000,
  });

  const { clusters, showsById } = useMemo(() => {
    const candidates = candidatesQ.data ?? [];
    const saved = savedQ.data ?? [];
    const log = engagementQ.data ?? { engagements: [], shows: [] };

    const showsById = new Map<string, CatalogShow>();
    for (const s of candidates) showsById.set(s.id, s);
    for (const s of log.shows) showsById.set(s.id, s);
    for (const s of saved) showsById.set(s.show.id, s.show);

    // saved shows count as save-engagements even when the engagement log
    // is empty (e.g. signed-out saves from before M5)
    const engagements = [...log.engagements];
    const engagedIds = new Set(engagements.map((e) => e.showId));
    for (const s of saved) {
      if (!engagedIds.has(s.show.id)) {
        engagements.push({ showId: s.show.id, type: "save" });
      }
    }
    const engagedShows = [...log.shows];
    const engagedShowIds = new Set(engagedShows.map((s) => s.id));
    for (const s of saved) {
      if (!engagedShowIds.has(s.show.id)) engagedShows.push(s.show);
    }

    const clusters = recommend({
      candidates: candidates.map(toShowInput),
      engagements,
      engagedShows: engagedShows.map(toShowInput),
      interests,
      impressions: getImpressions(),
      caps: { perCluster: 4, maxClusters: 8 },
    });
    return { clusters, showsById };
  }, [candidatesQ.data, savedQ.data, engagementQ.data, interests]);

  const needsOnboarding =
    prefsQ.isSuccess &&
    engagementQ.isSuccess &&
    savedQ.isSuccess &&
    interests.length === 0 &&
    (engagementQ.data?.engagements.length ?? 0) === 0 &&
    (savedQ.data?.length ?? 0) === 0;

  return {
    clusters,
    showsById,
    needsOnboarding,
    isLoading:
      prefsQ.isLoading ||
      engagementQ.isLoading ||
      savedQ.isLoading ||
      candidatesQ.isLoading,
    refresh: () => {
      void queryClient.invalidateQueries({ queryKey: ["engagement"] });
      void queryClient.invalidateQueries({ queryKey: ["saved"] });
    },
  };
}
