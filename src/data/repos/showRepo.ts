import type { CatalogShow } from "@/src/data/catalog/types";
import { getSupabase } from "@/src/data/supabase/client";
import type { ShowRow } from "@/src/data/supabase/types";

/** Catalog cache in the shared `shows` table. All failures are silent. */

export function rowToCatalogShow(row: ShowRow): CatalogShow {
  return {
    id: row.id,
    source: row.itunes_id ? "itunes" : "podcastindex",
    title: row.title,
    author: row.author ?? "",
    description: row.description ?? undefined,
    coverUrl: row.cover_url ?? undefined,
    feedUrl: row.feed_url ?? undefined,
    appleUrl: row.platform_links?.apple,
    categories: row.categories ?? [],
  };
}

export async function upsertShow(show: CatalogShow): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("shows").upsert({
    id: show.id,
    itunes_id: show.source === "itunes" ? show.id : null,
    feed_url: show.feedUrl ?? null,
    title: show.title,
    author: show.author || null,
    description: show.description ?? null,
    categories: show.categories,
    cover_url: show.coverUrl ?? null,
    platform_links: show.appleUrl ? { apple: show.appleUrl } : {},
    updated_at: new Date().toISOString(),
  });
  return !error;
}
