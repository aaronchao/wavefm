import type {
  CatalogEpisode,
  CatalogSearchResponse,
  CatalogShow,
  CatalogShowResponse,
  CommunityRecsResponse,
  DiscoverTopicsResponse,
  DiscussedChartsResponse,
  EpisodeChartsResponse,
  EpisodesRankedResponse,
  GlobalChartsResponse,
  PreviewEpisode,
  PreviewResponse,
  RankedEpisodeItem,
  SimilarResponse,
  TopPicksResponse,
  XyzrankBoardResponse,
  XyzrankTab,
} from "./types";

/** Browser-side typed client for /api/catalog/*. Failures degrade, never throw. */

/** Coerce an unknown JSON body to an array — a malformed 200 can never crash a list. */
function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export async function searchShows(q: string): Promise<CatalogSearchResponse> {
  try {
    const res = await fetch(`/api/catalog/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) return { shows: [], episodes: [], degraded: true };
    const json = (await res.json()) as Partial<CatalogSearchResponse>;
    return {
      shows: asArray<CatalogShow>(json.shows),
      episodes: asArray<CatalogEpisode>(json.episodes),
      degraded: Boolean(json.degraded),
    };
  } catch {
    return { shows: [], episodes: [], degraded: true };
  }
}

export async function getShow(id: string): Promise<CatalogShow | null> {
  try {
    const res = await fetch(`/api/catalog/show?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const json = (await res.json()) as Partial<CatalogShowResponse>;
    return json.show ?? null;
  } catch {
    return null;
  }
}

export async function getPreviewEpisodes(
  id: string,
  feedUrl?: string,
): Promise<PreviewEpisode[]> {
  try {
    const feed = feedUrl ? `&feedUrl=${encodeURIComponent(feedUrl)}` : "";
    const res = await fetch(`/api/catalog/preview?id=${encodeURIComponent(id)}${feed}`);
    if (!res.ok) return [];
    const json = (await res.json()) as Partial<PreviewResponse>;
    return asArray<PreviewEpisode>(json.episodes);
  } catch {
    return [];
  }
}

export async function getTopPicks(seedIds: string[]): Promise<TopPicksResponse> {
  try {
    const seeds = encodeURIComponent(seedIds.slice(0, 4).join(","));
    const res = await fetch(`/api/catalog/top-picks?seeds=${seeds}`);
    if (!res.ok) return { picks: [], degraded: true };
    const json = (await res.json()) as Partial<TopPicksResponse>;
    return { picks: asArray(json.picks), degraded: Boolean(json.degraded) };
  } catch {
    return { picks: [], degraded: true };
  }
}

export async function getRankedEpisodes(id: string): Promise<RankedEpisodeItem[]> {
  try {
    const res = await fetch(`/api/catalog/episodes-ranked?id=${encodeURIComponent(id)}`);
    if (!res.ok) return [];
    const json = (await res.json()) as Partial<EpisodesRankedResponse>;
    return asArray<RankedEpisodeItem>(json.episodes);
  } catch {
    return [];
  }
}

export async function getDiscussedCharts(limit = 24): Promise<DiscussedChartsResponse> {
  try {
    const res = await fetch(`/api/catalog/charts/discussed?limit=${limit}`);
    if (!res.ok) return { shows: [], degraded: true };
    const json = (await res.json()) as Partial<DiscussedChartsResponse>;
    return { shows: asArray(json.shows), degraded: Boolean(json.degraded) };
  } catch {
    return { shows: [], degraded: true };
  }
}

export async function getEpisodeCharts(limit = 20): Promise<EpisodeChartsResponse> {
  try {
    const res = await fetch(`/api/catalog/charts/episodes?limit=${limit}`);
    if (!res.ok) return { episodes: [], degraded: true };
    const json = (await res.json()) as Partial<EpisodeChartsResponse>;
    return { episodes: asArray(json.episodes), degraded: Boolean(json.degraded) };
  } catch {
    return { episodes: [], degraded: true };
  }
}

/** Always returns xyzrank's own full board for that tab (its own top 50). */
export async function getXyzrankBoard(tab: XyzrankTab): Promise<XyzrankBoardResponse> {
  try {
    const res = await fetch(`/api/catalog/charts/xyzrank?tab=${tab}`);
    if (!res.ok) return { tab, shows: [], episodes: [], degraded: true };
    const json = (await res.json()) as Partial<XyzrankBoardResponse>;
    return {
      tab,
      shows: asArray(json.shows),
      episodes: asArray(json.episodes),
      degraded: Boolean(json.degraded),
    };
  } catch {
    return { tab, shows: [], episodes: [], degraded: true };
  }
}

export async function getGlobalCharts(limit = 24): Promise<GlobalChartsResponse> {
  try {
    const res = await fetch(`/api/catalog/charts/global?limit=${limit}`);
    if (!res.ok) return { shows: [], degraded: true };
    const json = (await res.json()) as Partial<GlobalChartsResponse>;
    return { shows: asArray(json.shows), degraded: Boolean(json.degraded) };
  } catch {
    return { shows: [], degraded: true };
  }
}

export async function getDiscoverTopics(): Promise<DiscoverTopicsResponse> {
  try {
    const res = await fetch("/api/discover/topics");
    if (!res.ok) return { topics: [], degraded: true };
    const json = (await res.json()) as Partial<DiscoverTopicsResponse>;
    return { topics: asArray(json.topics), degraded: Boolean(json.degraded) };
  } catch {
    return { topics: [], degraded: true };
  }
}

export async function getCommunityRecs(
  seedId: string,
  limit = 12,
): Promise<CommunityRecsResponse> {
  try {
    const res = await fetch(
      `/api/recs/community?seed=${encodeURIComponent(seedId)}&limit=${limit}`,
    );
    if (!res.ok) return { shows: [], degraded: true };
    const json = (await res.json()) as Partial<CommunityRecsResponse>;
    return { shows: asArray(json.shows), degraded: Boolean(json.degraded) };
  } catch {
    return { shows: [], degraded: true };
  }
}

/**
 * Apple Podcasts deep link for a SPECIFIC episode, or null — never throws.
 * Only worth calling for episodes with no `appleUrl` of their own (those
 * came from RSS/Podcast Index); iTunes-sourced episodes already have one.
 */
export async function getAppleEpisodeLink(
  showId: string,
  title: string,
  audioUrl?: string,
): Promise<string | null> {
  try {
    const qs = new URLSearchParams({ showId, title });
    if (audioUrl) qs.set("audioUrl", audioUrl);
    const res = await fetch(`/api/catalog/episode-link?${qs.toString()}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { url?: string | null };
    return json.url ?? null;
  } catch {
    return null;
  }
}

/** Real Spotify show URL for a title (REFINEMENTS.md #5), or null — never throws. */
export async function getSpotifyLink(title: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/catalog/spotify-link?title=${encodeURIComponent(title)}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { url?: string | null };
    return json.url ?? null;
  } catch {
    return null;
  }
}

/** Real YouTube channel URL for a title (REFINEMENTS.md #6), or null — never throws. */
/**
 * `episodeTitle`, when given, resolves that specific episode's own video
 * (falls back to the show's channel only if no matching video is found)
 * instead of the channel directly — see the route's own doc for why.
 */
export async function getYoutubeLink(
  title: string,
  episodeTitle?: string,
): Promise<string | null> {
  try {
    const ep = episodeTitle ? `&episode=${encodeURIComponent(episodeTitle)}` : "";
    const res = await fetch(`/api/catalog/youtube-link?title=${encodeURIComponent(title)}${ep}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { url?: string | null };
    return json.url ?? null;
  } catch {
    return null;
  }
}

export async function getSimilar(id: string): Promise<SimilarResponse> {
  try {
    const res = await fetch(`/api/catalog/similar?id=${encodeURIComponent(id)}`);
    if (!res.ok) return { shows: [], episodes: [], degraded: true };
    const json = (await res.json()) as Partial<SimilarResponse>;
    return {
      shows: asArray(json.shows),
      episodes: asArray(json.episodes),
      degraded: Boolean(json.degraded),
    };
  } catch {
    return { shows: [], episodes: [], degraded: true };
  }
}
