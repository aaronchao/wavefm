import { searchShows } from "./client";
import type { CatalogShow } from "./types";

const MAX_TERMS = 4;
const PER_TERM = 8;

/**
 * Search the catalog by each of the user's own interest terms and merge the
 * results round-robin (one per term per pass), deduped by show id. Shared by
 * every "For You" surface that needs real catalog results keyed to the
 * user's own tags rather than a fixed default query.
 */
export async function searchShowsByTerms(
  terms: string[],
  { maxTerms = MAX_TERMS, perTerm = PER_TERM }: { maxTerms?: number; perTerm?: number } = {},
): Promise<{ term: string; show: CatalogShow }[]> {
  const list = [...new Set(terms.map((t) => t.trim()).filter(Boolean))].slice(0, maxTerms);
  if (list.length === 0) return [];

  const byTerm = await Promise.all(
    list.map(async (term) => {
      const res = await searchShows(term);
      return { term, shows: res.shows.filter((s) => Boolean(s.id)).slice(0, perTerm) };
    }),
  );

  const seen = new Set<string>();
  const merged: { term: string; show: CatalogShow }[] = [];
  const depth = Math.max(0, ...byTerm.map((t) => t.shows.length));
  for (let i = 0; i < depth; i++) {
    for (const { term, shows } of byTerm) {
      const show = shows[i];
      if (!show || seen.has(show.id)) continue;
      seen.add(show.id);
      merged.push({ term, show });
    }
  }
  return merged;
}
