import { enrichFromRss } from "./rss";
import { itunesLookup, piLookup } from "./server";
import type { CatalogShow } from "./types";

/** Bare show lookup: iTunes first, Podcast Index fallback. Null on failure. */
export async function lookupShow(id: string): Promise<CatalogShow | null> {
  return id.startsWith("pi-")
    ? await piLookup(id)
    : ((await itunesLookup(id)) ?? (await piLookup(id)));
}

/**
 * Show lookup with RSS enrichment, shared by /api/catalog/show and
 * /api/catalog/similar. iTunes lookup has no description; the feed does
 * (best-effort). Missing/unreachable -> null, never a throw.
 */
export async function lookupShowEnriched(id: string): Promise<CatalogShow | null> {
  const show = await lookupShow(id);

  if (show?.feedUrl && (!show.description || !show.lastEpisodeAt)) {
    const rss = await enrichFromRss(show.feedUrl);
    show.description ??= rss.description;
    show.lastEpisodeAt ??= rss.lastEpisodeAt;
    if (rss.categories && show.categories.length === 0) {
      show.categories = rss.categories;
    }
  }

  return show;
}
