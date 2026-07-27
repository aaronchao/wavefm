import type { CatalogShow } from "@/src/data/catalog/types";

/**
 * Ranks search results the way people actually scan them: exact/prefix title
 * match first (relevance), then newest-episode shows (recency) — no listen
 * counts are available from iTunes/Podcast Index, so this is the honest
 * proxy. PURE — no React/Next imports.
 */
export function sortSearchShows(shows: CatalogShow[], query: string): CatalogShow[] {
  const q = query.trim().toLowerCase();
  const relevance = (s: CatalogShow) => {
    const title = s.title.toLowerCase();
    if (title === q) return 0;
    if (title.startsWith(q)) return 1;
    if (title.includes(q)) return 2;
    return 3;
  };
  return [...shows].sort((a, b) => {
    const r = relevance(a) - relevance(b);
    if (r !== 0) return r;
    const da = a.lastEpisodeAt ? Date.parse(a.lastEpisodeAt) : 0;
    const db = b.lastEpisodeAt ? Date.parse(b.lastEpisodeAt) : 0;
    return db - da;
  });
}
