/** A show as returned by the catalog proxy (/api/catalog/*). */
export type CatalogShow = {
  /**
   * iTunes collectionId as string, `pi-<feedId>` for Podcast-Index-only
   * shows, or `rss-<hash>` for feed-only shows (e.g. OPML imports that
   * aren't in any catalog).
   */
  id: string;
  source: "itunes" | "podcastindex" | "rss";
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
  /** Matching episodes for the query (one-click "Later" to queue them). */
  episodes: CatalogEpisode[];
  /** True when every upstream provider failed (never a thrown error). */
  degraded: boolean;
};

export type CatalogShowResponse = {
  show: CatalogShow | null;
};

/** A real community discussion snippet behind a pick (tappable to open). */
export type EvidenceItem = {
  /** "Reddit", "V2EX", "小宇宙"… */
  source: string;
  /** A short quote or thread title. */
  text: string;
  /** Link to the actual thread/comment, when available. */
  url?: string;
};

export type SimilarShow = CatalogShow & {
  why: string;
  /** Real discussion behind the pick — populated for discussion-first picks. */
  evidence?: EvidenceItem[];
};

/** Response of /api/catalog/top-picks — curated, ranked top to bottom. */
export type TopPicksResponse = {
  picks: SimilarShow[];
  degraded: boolean;
};

/** Response of /api/catalog/charts/chinese — 中文播客榜, ranked top to bottom. */
export type ChineseChartsResponse = {
  shows: SimilarShow[];
  degraded: boolean;
};

/** Response of /api/catalog/charts/global — English/Global chart, ranked. */
export type GlobalChartsResponse = {
  shows: SimilarShow[];
  degraded: boolean;
};

/** Response of /api/catalog/charts/discussed — community discussion chart. */
export type DiscussedChartsResponse = {
  shows: SimilarShow[];
  degraded: boolean;
};

/** One row of the hot-EPISODES board (小宇宙 play/comment data). */
export type ChartEpisodeItem = {
  id: string;
  title: string;
  showTitle?: string;
  /** 小宇宙 episode page, when the board provides it. */
  url?: string;
  why: string;
};

/** Response of /api/catalog/charts/episodes — ranked hot episodes. */
export type EpisodeChartsResponse = {
  episodes: ChartEpisodeItem[];
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
