"use client";

import { useQuery } from "@tanstack/react-query";
import { getDiscussedCharts, getTopPicks } from "@/src/data/catalog/client";
import { searchShowsByTerms } from "@/src/data/catalog/interestSearch";
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

/** First occurrence wins — keeps evidence-backed picks ahead of searched ones. */
function dedupeById(shows: SimilarShow[]): SimilarShow[] {
  const seen = new Set<string>();
  const out: SimilarShow[] = [];
  for (const s of shows) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    out.push(s);
  }
  return out;
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
  /** §5 P2: some providers failed but enough came through to still show picks. */
  degraded: boolean;
};

/**
 * The ranked recommendations, shared by the hero and the ranked list.
 * With saved shows we personalise (discussion-first top-picks around your
 * taste); with none, we lead with the community-discussed board (Reddit /
 * V2EX / Dcard / 小宇宙) so a cold start still gets genuinely-discussed
 * picks — not thin catalog noise.
 *
 * Filtering, in priority order:
 *   1. An explicitly tapped topic chip (`topic`) — exact single-interest lens.
 *   2. Otherwise, when the user has custom interests (Settings), the pool is
 *      narrowed to ANY of them — "For You" logic driving Today's Picks by
 *      default, with no click required.
 *   3. If a filter ever produces zero matches, fall back to the full pool so
 *      the page is never empty.
 */
export function useDiscoverPicks({
  seedIds,
  topic,
  interests = [],
  savedReady,
}: {
  seedIds: string[];
  topic: string | null;
  /** The user's custom interests from Settings — drives the default lens. */
  interests?: string[];
  savedReady: boolean;
}): DiscoverPicks {
  const hasSeeds = seedIds.length > 0;

  const picksQ = useQuery({
    queryKey: ["catalog", "top-picks", seedIds.join(",")],
    queryFn: () => getTopPicks(seedIds),
    enabled: savedReady && hasSeeds,
    staleTime: 6 * 60 * 60 * 1000,
  });
  // shares the Charts "discussed" cache — no double fetch
  const discussedQ = useQuery({
    queryKey: ["catalog", "charts", "discussed"],
    queryFn: () => getDiscussedCharts(24),
    enabled: savedReady && !hasSeeds,
    staleTime: 6 * 60 * 60 * 1000,
  });

  const all = (hasSeeds ? (picksQ.data?.picks ?? []) : (discussedQ.data?.shows ?? [])).filter(
    (p) => Boolean(p.id),
  );

  // The default "For You" lens: search the catalog by the user's own
  // interests directly, rather than hoping they happen to appear in
  // whatever pool `all` already is — a niche or non-English interest
  // rarely shows up in a generic discussed/top-picks board.
  // Shares its cache (and its shape) with any other "For You" surface
  // searching the same terms — TrendingShelf in particular — so the two
  // never collide under the same query key with different return types.
  const searchQ = useQuery({
    queryKey: ["catalog", "interest-search", interests.join(",")],
    queryFn: () => searchShowsByTerms(interests),
    enabled: !topic && interests.length > 0,
    staleTime: 6 * 60 * 60 * 1000,
  });
  const searched: SimilarShow[] = (searchQ.data ?? []).map(({ term, show }) => ({
    ...show,
    why: `Because you follow ${term}`,
  }));

  const topicFiltered = topic ? all.filter((p) => matchesTopic(p, topic)) : null;
  const interestFiltered =
    !topic && interests.length > 0
      ? all.filter((p) => interests.some((i) => matchesTopic(p, i)))
      : null;
  // Evidence-backed matches (real discussion behind them) lead; a plain
  // catalog search fills in the rest so the lens is never thin.
  const interestPicks =
    !topic && interests.length > 0 ? dedupeById([...(interestFiltered ?? []), ...searched]) : null;
  const filtered = topicFiltered ?? interestPicks;
  const picks = filtered && filtered.length > 0 ? filtered : all;

  return {
    hero: picks[0] ?? null,
    rest: picks.slice(1),
    count: picks.length,
    topicApplied: Boolean(topic) && (topicFiltered?.length ?? 0) > 0,
    isLoading: hasSeeds
      ? picksQ.isLoading
      : discussedQ.isLoading || (searchQ.isLoading && all.length === 0),
    degraded: Boolean(hasSeeds ? picksQ.data?.degraded : discussedQ.data?.degraded),
  };
}
