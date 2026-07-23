"use client";

import { useQueries } from "@tanstack/react-query";
import { searchShows } from "@/src/data/catalog/client";
import type { CatalogEpisode } from "@/src/data/catalog/types";

/**
 * The latest episodes related to a set of "For You" interest terms — the
 * data behind a selected tag's episode feed and the Wavr deck. Each term is
 * an iTunes episode search (shares TrendingShelf's `["catalog","search",t]`
 * cache, so no double fetch), newest-first, interleaved across terms and
 * de-duplicated. Playable episodes (real audio) lead. Fully client-side;
 * failures degrade to an empty list, never throw.
 */
export function useInterestEpisodes(
  terms: string[],
  { enabled = true, perTerm = 6 }: { enabled?: boolean; perTerm?: number } = {},
): { episodes: CatalogEpisode[]; isLoading: boolean } {
  const uniq = [...new Set(terms.map((t) => t.trim()).filter(Boolean))].slice(0, 6);
  const results = useQueries({
    queries: uniq.map((t) => ({
      queryKey: ["catalog", "search", t],
      queryFn: () => searchShows(t),
      enabled,
      staleTime: 6 * 60 * 60 * 1000,
    })),
  });

  const byTerm = results.map((r) =>
    [...(r.data?.episodes ?? [])]
      .sort((a, b) => tsOf(b) - tsOf(a)) // latest first
      .slice(0, perTerm),
  );

  // Interleave one-per-term (round-robin) so no single interest dominates the
  // top of the feed, de-duping by episode id as we go.
  const seen = new Set<string>();
  const episodes: CatalogEpisode[] = [];
  const depth = Math.max(0, ...byTerm.map((l) => l.length));
  for (let i = 0; i < depth; i++) {
    for (const list of byTerm) {
      const ep = list[i];
      if (!ep || seen.has(ep.id)) continue;
      seen.add(ep.id);
      episodes.push(ep);
    }
  }

  // Episodes with real audio surface first — the rest can still fall back to
  // the parent show's feed, but a playable card is the better lead.
  episodes.sort((a, b) => Number(Boolean(b.audioUrl)) - Number(Boolean(a.audioUrl)));

  const isLoading = enabled && uniq.length > 0 && results.some((r) => r.isLoading);
  return { episodes, isLoading };
}

function tsOf(ep: CatalogEpisode): number {
  return ep.publishedAt ? Date.parse(ep.publishedAt) || 0 : 0;
}
