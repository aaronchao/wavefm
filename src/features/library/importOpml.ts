"use client";

import { parseOpml } from "@/src/core/opml";
import { searchShows } from "@/src/data/catalog/client";
import type { CatalogShow } from "@/src/data/catalog/types";
import { saveShow } from "@/src/data/repos/savedShowsRepo";

export type ImportResult = { imported: number; total: number };

/**
 * Import a subscription list from an OPML file (exported from Pocket Casts,
 * Apple Podcasts, Overcast, AntennaPod…) and save every show that resolves
 * in our catalog. Saves go through the normal repo, so when the user is
 * signed in they land in Supabase and sync to every device on their own —
 * import once, and the list is just there everywhere. Best-effort per feed:
 * one that can't be resolved is skipped, never fails the whole import.
 */
export async function importSubscriptionsOpml(file: File): Promise<ImportResult> {
  const feeds = parseOpml(await file.text());
  let imported = 0;

  // resolve + save in small batches to stay a good API citizen
  const BATCH = 5;
  for (let i = 0; i < feeds.length; i += BATCH) {
    const batch = feeds.slice(i, i + BATCH);
    const shows = await Promise.all(batch.map((f) => resolveFeed(f.title, f.feedUrl)));
    for (const show of shows) {
      if (show) {
        await saveShow(show);
        imported += 1;
      }
    }
  }
  return { imported, total: feeds.length };
}

const canonical = (url?: string) => (url ?? "").replace(/\/+$/, "").toLowerCase();

/**
 * Resolve an OPML entry to a catalog show: search by its title, then prefer
 * the result whose feed URL matches exactly (accurate), else the top hit.
 */
async function resolveFeed(title: string, feedUrl: string): Promise<CatalogShow | null> {
  const { shows } = await searchShows(title);
  if (shows.length === 0) return null;
  return shows.find((s) => canonical(s.feedUrl) === canonical(feedUrl)) ?? shows[0];
}
