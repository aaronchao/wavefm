import type {
  CatalogSearchResponse,
  CatalogShow,
  CatalogShowResponse,
  EpisodesRankedResponse,
  PreviewEpisode,
  PreviewResponse,
  RankedEpisodeItem,
  SimilarResponse,
  TopPicksResponse,
} from "./types";

/** Browser-side typed client for /api/catalog/*. Failures degrade, never throw. */

/** Coerce an unknown JSON body to an array — a malformed 200 can never crash a list. */
function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export async function searchShows(q: string): Promise<CatalogSearchResponse> {
  try {
    const res = await fetch(`/api/catalog/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) return { shows: [], degraded: true };
    const json = (await res.json()) as Partial<CatalogSearchResponse>;
    return { shows: asArray<CatalogShow>(json.shows), degraded: Boolean(json.degraded) };
  } catch {
    return { shows: [], degraded: true };
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

export async function getPreviewEpisodes(id: string): Promise<PreviewEpisode[]> {
  try {
    const res = await fetch(`/api/catalog/preview?id=${encodeURIComponent(id)}`);
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
