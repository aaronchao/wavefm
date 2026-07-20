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
  /** Total episodes published (iTunes trackCount; longevity signal). */
  episodeCount?: number;
};

/** A single episode as returned by the catalog proxy (similar-content only). */
export type CatalogEpisode = {
  /** iTunes trackId as string. */
  id: string;
  title: string;
  /** Parent show (iTunes collectionId / name), when known. */
  showId?: string;
  showTitle?: string;
  description?: string;
  coverUrl?: string;
  /** Apple Podcasts episode web URL (deep-link OUT). */
  appleUrl?: string;
  categories: string[];
  publishedAt?: string;
  /** Direct audio URL (iTunes episodeUrl) — enables 30-sec previews. */
  audioUrl?: string;
  durationSec?: number;
};

/** One playable episode of a show, for preview clips. */
export type PreviewEpisode = {
  title: string;
  audioUrl: string;
  durationSec?: number;
};

export type PreviewResponse = {
  episodes: PreviewEpisode[];
};

export type CatalogSearchResponse = {
  shows: CatalogShow[];
  /** True when every upstream provider failed (never a thrown error). */
  degraded: boolean;
};

export type CatalogShowResponse = {
  show: CatalogShow | null;
};

export type SimilarShow = CatalogShow & { why: string };

/** Response of /api/catalog/top-picks — curated, ranked top to bottom. */
export type TopPicksResponse = {
  picks: SimilarShow[];
  degraded: boolean;
};

/** One ranked episode of a show (for the discovery "top episodes" list). */
export type RankedEpisodeItem = {
  id: string;
  title: string;
  audioUrl?: string;
  durationSec?: number;
  publishedAt?: string;
  /** What actually drove the rank (no faked listen counts). */
  basis: "discussion" | "rating" | "recent";
  why: string;
};

export type EpisodesRankedResponse = {
  episodes: RankedEpisodeItem[];
  degraded: boolean;
};
export type SimilarEpisode = CatalogEpisode & { why: string };

/** Response of /api/catalog/similar — ranked top to bottom. */
export type SimilarResponse = {
  shows: SimilarShow[];
  episodes: SimilarEpisode[];
  /** True when every upstream provider failed (never a thrown error). */
  degraded: boolean;
};
