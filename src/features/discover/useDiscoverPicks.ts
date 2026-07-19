"use client";

import { useQuery } from "@tanstack/react-query";
import { getTopPicks } from "@/src/data/catalog/client";
import type { SimilarShow } from "@/src/data/catalog/types";

/** Match a show to a topic label by any significant shared keyword. */
function matchesTopic(show: SimilarShow, topic: string): boolean {
  const words = topic
    .toLowerCase()
    .split(/[^a-z一-鿿]+/)
    .filter((w) => w.length > 3 || /[一-鿿]/.test(w));
  const hay = `${show.title} ${show.categories.join(" ")}`.toLowerCase();
  return words.some((w) => hay.includes(w));
}

export type DiscoverPicks = {
  /** The single best pick — the For-You hero. */
  hero: SimilarShow | null;
  /** Everything after the hero, for the ranked list. */
  rest: SimilarShow[];
  count: number;
  /** True when the topic chip actually narrowed the set (vs. fell back). */
  topicApplied: boolean;
  isLoading: boolean;
};

/**
 * The personalized ranked recommendations, shared by the hero and the
 * ranked list so they draw from one query. Falls back to the trending
 * chart when the user hasn't saved anything (the proxy handles that). A
 * topic chip filters to matching shows, keeping the full set if nothing
 * matches so the page is never empty.
 */
export function useDiscoverPicks({
  seedIds,
  topic,
  savedReady,
}: {
  seedIds: string[];
  topic: string | null;
  savedReady: boolean;
}): DiscoverPicks {
  const q = useQuery({
    queryKey: ["catalog", "top-picks", seedIds.join(",")],
    queryFn: () => getTopPicks(seedIds),
    enabled: savedReady,
    staleTime: 6 * 60 * 60 * 1000,
  });

  const all = q.data?.picks ?? [];
  const filtered = topic ? all.filter((p) => matchesTopic(p, topic)) : all;
  const picks = filtered.length > 0 ? filtered : all;

  return {
    hero: picks[0] ?? null,
    rest: picks.slice(1),
    count: picks.length,
    topicApplied: Boolean(topic) && filtered.length > 0,
    isLoading: q.isLoading,
  };
}
