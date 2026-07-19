import { createHash } from "node:crypto";
import type { CatalogEpisode, CatalogShow } from "./types";

/**
 * Server-side catalog providers: iTunes Search (primary, no key) with
 * Podcast Index as secondary (free key, optional). Called only from
 * /app/api/catalog/* route handlers — never from the browser.
 * Providers return null on any failure; they never throw to the caller.
 */

const ITUNES_REVALIDATE_SECONDS = 60 * 60; // catalog cache: hours

type ItunesResult = {
  collectionId?: number;
  collectionName?: string;
  artistName?: string;
  feedUrl?: string;
  collectionViewUrl?: string;
  artworkUrl600?: string;
  artworkUrl100?: string;
  artworkUrl160?: string;
  /** Strings on podcast collections; {name} objects on episode results. */
  genres?: (string | { name?: string })[];
  /** Latest release date of the collection (or the episode's own date). */
  releaseDate?: string;
  /** Episode count for podcast collections. */
  trackCount?: number;
  /** Episode fields (entity=podcastEpisode). */
  trackId?: number;
  trackName?: string;
  trackViewUrl?: string;
  description?: string;
  shortDescription?: string;
  /** Direct audio URL on episode results. */
  episodeUrl?: string;
  trackTimeMillis?: number;
};

function isoOrUndefined(date?: string): string | undefined {
  return date && !Number.isNaN(Date.parse(date))
    ? new Date(date).toISOString()
    : undefined;
}

function itunesGenres(genres?: (string | { name?: string })[]): string[] {
  return (genres ?? [])
    .map((g) => (typeof g === "string" ? g : (g.name ?? "")))
    .filter((g) => g && g !== "Podcasts");
}

function mapItunes(r: ItunesResult): CatalogShow | null {
  if (!r.collectionId || !r.collectionName) return null;
  return {
    id: String(r.collectionId),
    source: "itunes",
    title: r.collectionName,
    author: r.artistName ?? "",
    coverUrl: r.artworkUrl600 ?? r.artworkUrl100,
    feedUrl: r.feedUrl,
    appleUrl: r.collectionViewUrl,
    categories: itunesGenres(r.genres),
    lastEpisodeAt: isoOrUndefined(r.releaseDate),
    episodeCount: r.trackCount,
  };
}

function mapItunesEpisode(r: ItunesResult): CatalogEpisode | null {
  if (!r.trackId || !r.trackName) return null;
  return {
    id: String(r.trackId),
    title: r.trackName,
    showId: r.collectionId ? String(r.collectionId) : undefined,
    showTitle: r.collectionName,
    description: r.description ?? r.shortDescription,
    coverUrl: r.artworkUrl600 ?? r.artworkUrl160 ?? r.artworkUrl100,
    appleUrl: r.trackViewUrl,
    categories: itunesGenres(r.genres),
    publishedAt: isoOrUndefined(r.releaseDate),
    audioUrl: r.episodeUrl,
    durationSec:
      r.trackTimeMillis && r.trackTimeMillis > 0
        ? Math.floor(r.trackTimeMillis / 1000)
        : undefined,
  };
}

async function itunesFetch(url: string): Promise<ItunesResult[] | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate: ITUNES_REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { results?: ItunesResult[] };
    return json.results ?? [];
  } catch {
    return null;
  }
}

export async function itunesSearch(
  q: string,
  country?: string,
): Promise<CatalogShow[] | null> {
  const cc = country ? `&country=${encodeURIComponent(country)}` : "";
  const url = `https://itunes.apple.com/search?media=podcast&limit=25${cc}&term=${encodeURIComponent(q)}`;
  const results = await itunesFetch(url);
  if (results === null) return null;
  return results.map(mapItunes).filter((s): s is CatalogShow => s !== null);
}

export async function itunesLookup(id: string): Promise<CatalogShow | null> {
  const url = `https://itunes.apple.com/lookup?entity=podcast&id=${encodeURIComponent(id)}`;
  const results = await itunesFetch(url);
  return results?.map(mapItunes).find((s) => s !== null) ?? null;
}

export async function itunesEpisodeSearch(
  q: string,
): Promise<CatalogEpisode[] | null> {
  const url = `https://itunes.apple.com/search?media=podcast&entity=podcastEpisode&limit=25&term=${encodeURIComponent(q)}`;
  const results = await itunesFetch(url);
  if (results === null) return null;
  return results
    .map(mapItunesEpisode)
    .filter((e): e is CatalogEpisode => e !== null);
}

const CHART_REVALIDATE_SECONDS = 6 * 60 * 60; // charts move slowly

type ChartEntry = {
  id?: string;
  name?: string;
  artistName?: string;
  url?: string;
  artworkUrl100?: string;
  genres?: { name?: string }[];
};

async function fetchTopChart(country = "us"): Promise<ChartEntry[] | null> {
  const cc = /^[a-z]{2}$/i.test(country) ? country.toLowerCase() : "us";
  try {
    const res = await fetch(
      `https://rss.marketingtools.apple.com/api/v2/${cc}/podcasts/top/100/podcasts.json`,
      { next: { revalidate: CHART_REVALIDATE_SECONDS } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { feed?: { results?: ChartEntry[] } };
    return json.feed?.results ?? [];
  } catch {
    return null;
  }
}

/**
 * Apple's top-podcasts chart (free RSS, no key) for a storefront (default
 * US). Returns collectionId -> 1-based chart rank, or null when
 * unreachable — a popularity proxy, since real listen counts aren't public
 * on any free API.
 */
export async function itunesTopChartRanks(country = "us"): Promise<Map<string, number> | null> {
  const entries = await fetchTopChart(country);
  if (entries === null) return null;
  const ranks = new Map<string, number>();
  entries.forEach((entry, i) => {
    if (entry.id) ranks.set(String(entry.id), i + 1);
  });
  return ranks;
}

/** The same chart as candidate shows (chart ids are iTunes collection ids). */
export async function itunesTopChartShows(country = "us"): Promise<CatalogShow[] | null> {
  const entries = await fetchTopChart(country);
  if (entries === null) return null;
  return entries
    .filter((e): e is ChartEntry & { id: string; name: string } =>
      Boolean(e.id && e.name),
    )
    .map((e) => ({
      id: String(e.id),
      source: "itunes" as const,
      title: e.name,
      author: e.artistName ?? "",
      coverUrl: e.artworkUrl100,
      appleUrl: e.url,
      categories: (e.genres ?? [])
        .map((g) => g.name ?? "")
        .filter((g) => g && g !== "Podcasts"),
    }));
}

type PiFeed = {
  id?: number;
  itunesId?: number | null;
  title?: string;
  author?: string;
  description?: string;
  image?: string;
  artwork?: string;
  url?: string;
  link?: string;
  categories?: Record<string, string> | null;
  /** Unix seconds of the newest item, when the endpoint provides it. */
  newestItemPubdate?: number;
  episodeCount?: number;
};

function mapPi(f: PiFeed): CatalogShow | null {
  if (!f.id || !f.title) return null;
  return {
    id: f.itunesId ? String(f.itunesId) : `pi-${f.id}`,
    source: "podcastindex",
    title: f.title,
    author: f.author ?? "",
    description: f.description,
    coverUrl: f.image || f.artwork,
    feedUrl: f.url,
    categories: f.categories ? Object.values(f.categories) : [],
    lastEpisodeAt:
      f.newestItemPubdate && f.newestItemPubdate > 0
        ? new Date(f.newestItemPubdate * 1000).toISOString()
        : undefined,
    episodeCount: f.episodeCount,
  };
}

function piHeaders(): HeadersInit | null {
  const key = process.env.PODCAST_INDEX_API_KEY;
  const secret = process.env.PODCAST_INDEX_API_SECRET;
  if (!key || !secret) return null;
  const authDate = String(Math.floor(Date.now() / 1000));
  const authorization = createHash("sha1")
    .update(key + secret + authDate)
    .digest("hex");
  return {
    "X-Auth-Key": key,
    "X-Auth-Date": authDate,
    Authorization: authorization,
    "User-Agent": "wavr/0.1 (podcast discovery)",
  };
}

async function piFetch(path: string): Promise<PiFeed[] | null> {
  const headers = piHeaders();
  if (!headers) return null; // keys not configured — silently skip
  try {
    const res = await fetch(`https://api.podcastindex.org/api/1.0${path}`, {
      headers,
      // auth headers change every second, so Next's fetch cache can't help
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { feeds?: PiFeed[]; feed?: PiFeed };
    if (json.feeds) return json.feeds;
    if (json.feed && Object.keys(json.feed).length > 0) return [json.feed];
    return [];
  } catch {
    return null;
  }
}

export async function piSearch(q: string): Promise<CatalogShow[] | null> {
  const feeds = await piFetch(`/search/byterm?max=25&q=${encodeURIComponent(q)}`);
  if (feeds === null) return null;
  return feeds.map(mapPi).filter((s): s is CatalogShow => s !== null);
}

/**
 * Podcast Index trending list (free key). Returns show id -> 1-based
 * trending rank (keyed the same way mapPi keys ids), or null when the
 * keys aren't configured or the API is unreachable.
 */
export async function piTrendingRanks(): Promise<Map<string, number> | null> {
  const feeds = await piFetch(`/podcasts/trending?max=100`);
  if (feeds === null) return null;
  const ranks = new Map<string, number>();
  feeds.forEach((f, i) => {
    if (!f.id) return;
    ranks.set(f.itunesId ? String(f.itunesId) : `pi-${f.id}`, i + 1);
  });
  return ranks;
}

/** Podcast Index trending shows (free key) — an independent, non-Apple pool. */
export async function piTrendingShows(): Promise<CatalogShow[] | null> {
  const feeds = await piFetch(`/podcasts/trending?max=100`);
  if (feeds === null) return null;
  return feeds.map(mapPi).filter((s): s is CatalogShow => s !== null);
}

export async function piLookup(id: string): Promise<CatalogShow | null> {
  const path = id.startsWith("pi-")
    ? `/podcasts/byfeedid?id=${encodeURIComponent(id.slice(3))}`
    : `/podcasts/byitunesid?id=${encodeURIComponent(id)}`;
  const feeds = await piFetch(path);
  return feeds?.map(mapPi).find((s) => s !== null) ?? null;
}
