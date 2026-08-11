/** Known player deep-links for a show, when the payload provides them. */
export type PlatformLinks = {
  apple?: string;
  spotify?: string;
  youtubeMusic?: string;
  pocketCasts?: string;
  xiaoyuzhou?: string;
};

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
  /**
   * Stored player deep-links from the payload. A present URL renders the
   * icon in brand colour; a missing one renders grayscale/disabled. Never
   * hardcoded — populated by the catalog/backend when known.
   */
  platformLinks?: PlatformLinks;
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
  /**
   * Lexicon sentiment of `text` in [-1, 1] (REFINEMENTS.md #20), via
   * src/core/mining/sentiment.ts's bilingual cue-word scorer — the same
   * one the community-mining pipeline uses. Undefined where a source
   * hasn't been wired to score it yet; 0 means "scored, no cue words
   * found" (neutral), not "not scored".
   */
  sentiment?: number;
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

/** xyzrank.com's four boards — see src/data/buzz/xyzrank.ts. */
export type XyzrankTab = "podcasts" | "new-podcasts" | "episodes" | "new-episodes";

/**
 * One show row on a xyzrank podcast board (热门播客/新晋播客). Metrics are
 * kept as raw numbers (not a pre-formatted string) so the UI renders them
 * as compact icon chips rather than a sentence. Links/cover come directly
 * from xyzrank's own data (the show's creator submitted them), not a fuzzy
 * iTunes-search guess — `id` is the real iTunes id whenever resolvable from
 * the apple link, so Save/the show page/ranked episodes all work normally.
 */
export type XyzrankShowItem = {
  id: string;
  rank: number;
  title: string;
  author?: string;
  category?: string;
  coverUrl?: string;
  feedUrl?: string;
  appleUrl?: string;
  xiaoyuzhouUrl?: string;
  episodeCount?: number;
  lastReleaseDaysAgo?: number;
  avgPlays?: number;
  avgComments?: number;
  avgDurationSec?: number;
};

/** One episode row on a xyzrank episode board (热门单集/新晋单集). */
export type XyzrankEpisodeItem = {
  id: string;
  rank: number;
  title: string;
  showTitle?: string;
  /** Parent show's catalog id, when resolved — powers OpenInLinks/Pocket Casts. */
  showId?: string;
  /** Parent show's RSS feed, when resolved — powers the YouTube Music assist. */
  feedUrl?: string;
  appleUrl?: string;
  coverUrl?: string;
  platformLinks?: PlatformLinks;
  /** xyzrank/小宇宙's own episode page. */
  url?: string;
  plays?: number;
  comments?: number;
  /** The parent show's subscriber count at ranking time. */
  subscribers?: number;
  durationSec?: number;
  publishedAt?: string;
};

/** Response of /api/catalog/charts/xyzrank — one of xyzrank.com's four boards. */
export type XyzrankBoardResponse = {
  tab: XyzrankTab;
  shows: XyzrankShowItem[];
  episodes: XyzrankEpisodeItem[];
  degraded: boolean;
};

/** One ranked episode of a show (for the discovery "top episodes" list). */
export type RankedEpisodeItem = {
  id: string;
  title: string;
  audioUrl?: string;
  durationSec?: number;
  publishedAt?: string;
  /** What actually drove the rank. */
  basis: "discussion" | "rating" | "recent" | "listens";
  why: string;
  /**
   * Total plays for this episode when the backend provides it. Drives the
   * "most listened" ordering on the show page; absent → ranked by `basis`.
   */
  listens?: number;
};

export type EpisodesRankedResponse = {
  episodes: RankedEpisodeItem[];
  degraded: boolean;
};
export type SimilarEpisode = CatalogEpisode & { why: string };

/** A trending topic chip for the Discover "pick a topic" row. */
export type DiscoverTopic = { label: string; query: string; lang: "en" | "zh" };

/** Response of /api/discover/topics — a live EN + 中文 trending mix. */
export type DiscoverTopicsResponse = {
  topics: DiscoverTopic[];
  degraded: boolean;
};

/** Response of /api/recs/community — mined from real community discussion. */
export type CommunityRecsResponse = {
  shows: SimilarShow[];
  degraded: boolean;
};

/** Response of /api/catalog/similar — ranked top to bottom. */
export type SimilarResponse = {
  shows: SimilarShow[];
  episodes: SimilarEpisode[];
  /** True when every upstream provider failed (never a thrown error). */
  degraded: boolean;
};
