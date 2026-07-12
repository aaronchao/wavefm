import { createHash } from "node:crypto";
import type { CatalogShow } from "./types";

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
  genres?: string[];
};

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
    categories: (r.genres ?? []).filter((g) => g !== "Podcasts"),
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

export async function itunesSearch(q: string): Promise<CatalogShow[] | null> {
  const url = `https://itunes.apple.com/search?media=podcast&limit=25&term=${encodeURIComponent(q)}`;
  const results = await itunesFetch(url);
  if (results === null) return null;
  return results.map(mapItunes).filter((s): s is CatalogShow => s !== null);
}

export async function itunesLookup(id: string): Promise<CatalogShow | null> {
  const url = `https://itunes.apple.com/lookup?entity=podcast&id=${encodeURIComponent(id)}`;
  const results = await itunesFetch(url);
  return results?.map(mapItunes).find((s) => s !== null) ?? null;
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

export async function piLookup(id: string): Promise<CatalogShow | null> {
  const path = id.startsWith("pi-")
    ? `/podcasts/byfeedid?id=${encodeURIComponent(id.slice(3))}`
    : `/podcasts/byitunesid?id=${encodeURIComponent(id)}`;
  const feeds = await piFetch(path);
  return feeds?.map(mapPi).find((s) => s !== null) ?? null;
}
