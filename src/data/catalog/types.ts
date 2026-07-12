/** A show as returned by the catalog proxy (/api/catalog/*). */
export type CatalogShow = {
  /** iTunes collectionId as string, or `pi-<feedId>` for Podcast-Index-only shows. */
  id: string;
  source: "itunes" | "podcastindex";
  title: string;
  author: string;
  description?: string;
  coverUrl?: string;
  feedUrl?: string;
  /** Apple Podcasts web URL (deep-link OUT, used from M6). */
  appleUrl?: string;
  categories: string[];
  /** ISO date of the latest episode (RSS-enriched; freshness signal). */
  lastEpisodeAt?: string;
};

export type CatalogSearchResponse = {
  shows: CatalogShow[];
  /** True when every upstream provider failed (never a thrown error). */
  degraded: boolean;
};

export type CatalogShowResponse = {
  show: CatalogShow | null;
};
