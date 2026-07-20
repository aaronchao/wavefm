"use client";

import { parseOpml, stableFeedId, type OpmlFeed } from "@/src/core/opml";
import { searchShows } from "@/src/data/catalog/client";
import type { CatalogShow } from "@/src/data/catalog/types";
import { saveShow } from "@/src/data/repos/savedShowsRepo";

export type ImportResult = { imported: number; total: number };

/**
 * Import a subscription list from an OPML file (Pocket Casts, Apple
 * Podcasts, Overcast, 小宇宙…) — every feed is imported, no exceptions.
 * We first try to match the feed to a catalog show (exact feed URL, then
 * exact title) so imports get art/links; anything the catalog doesn't
 * know (小宇宙-only shows, tiny indies) is saved directly from the feed
 * itself as an `rss-` show — still playable via its RSS and exportable.
 * Saves go through the normal repo, so signed-in users sync everywhere.
 */
export async function importSubscriptionsOpml(file: File): Promise<ImportResult> {
  const feeds = parseOpml(await file.text());
  let imported = 0;

  // resolve + save in small batches to stay a good API citizen
  const BATCH = 5;
  for (let i = 0; i < feeds.length; i += BATCH) {
    const batch = feeds.slice(i, i + BATCH);
    const shows = await Promise.all(batch.map((f) => resolveFeed(f)));
    for (const show of shows) {
      await saveShow(show);
      imported += 1;
    }
  }
  return { imported, total: feeds.length };
}

const canonical = (url?: string) => (url ?? "").replace(/\/+$/, "").toLowerCase();
const norm = (t: string) => t.trim().toLowerCase();

/**
 * Resolve an OPML entry to a catalog show only on a CONFIDENT match
 * (same feed URL, or same title) — a wrong show is worse than a plain
 * feed. No match -> a feed-only show built from the OPML entry.
 */
async function resolveFeed(feed: OpmlFeed): Promise<CatalogShow> {
  const { shows } = await searchShows(feed.title);
  const match =
    shows.find((s) => canonical(s.feedUrl) === canonical(feed.feedUrl)) ??
    shows.find((s) => norm(s.title) === norm(feed.title));
  return match ?? rssShow(feed);
}

/** A show carried entirely by its RSS feed — no catalog entry needed. */
function rssShow(feed: OpmlFeed): CatalogShow {
  return {
    id: stableFeedId(feed.feedUrl),
    source: "rss",
    title: feed.title,
    author: "",
    description: feed.description,
    feedUrl: feed.feedUrl,
    categories: [],
  };
}
