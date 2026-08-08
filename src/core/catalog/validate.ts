import type { CatalogEpisode, CatalogShow, PlatformLinks } from "@/src/data/catalog/types";

/**
 * Runtime validation for catalog payloads (PURE).
 *
 * The client parsers used `as Partial<T>` and handed the result straight to
 * the UI, which is a cast, not a check — TypeScript erases at runtime, so a
 * malformed payload sails through and blows up later on something like
 * `show.categories.length`, far from the actual cause.
 *
 * Deliberately LENIENT rather than strict. A parser that rejected a whole
 * show because one optional field had the wrong type would turn a cosmetic
 * upstream glitch into an empty Library. So: an entry survives if its
 * essentials are sound (id + title), and every questionable optional field
 * is dropped rather than taken on faith. Bad entries in a list are skipped
 * individually, never failing the batch.
 */

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Only strings survive; a non-array becomes [] so `.length` is always safe. */
function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim() !== "");
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const SOURCES = new Set(["itunes", "podcastindex", "rss"]);

function platformLinks(v: unknown): PlatformLinks | undefined {
  if (!isObject(v)) return undefined;
  const out: PlatformLinks = {};
  for (const k of ["apple", "spotify", "youtubeMusic", "pocketCasts", "xiaoyuzhou"] as const) {
    const url = str(v[k]);
    if (url) out[k] = url;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** A show, or null when the essentials aren't there. */
export function parseShow(v: unknown): CatalogShow | null {
  if (!isObject(v)) return null;
  const id = str(v.id);
  const title = str(v.title);
  if (!id || !title) return null;

  const source = str(v.source);
  return {
    id,
    title,
    // An unrecognised source is still a usable show — default rather than drop.
    source: (source && SOURCES.has(source) ? source : "rss") as CatalogShow["source"],
    author: str(v.author) ?? "",
    description: str(v.description),
    coverUrl: str(v.coverUrl),
    feedUrl: str(v.feedUrl),
    appleUrl: str(v.appleUrl),
    categories: strArray(v.categories),
    lastEpisodeAt: str(v.lastEpisodeAt),
    episodeCount: num(v.episodeCount),
    platformLinks: platformLinks(v.platformLinks),
  };
}

/** An episode, or null when the essentials aren't there. */
export function parseEpisode(v: unknown): CatalogEpisode | null {
  if (!isObject(v)) return null;
  const id = str(v.id);
  const title = str(v.title);
  if (!id || !title) return null;

  const durationSec = num(v.durationSec);
  return {
    id,
    title,
    showId: str(v.showId),
    showTitle: str(v.showTitle),
    description: str(v.description),
    coverUrl: str(v.coverUrl),
    appleUrl: str(v.appleUrl),
    categories: strArray(v.categories),
    publishedAt: str(v.publishedAt),
    audioUrl: str(v.audioUrl),
    // A negative or zero duration is noise, not information.
    durationSec: durationSec != null && durationSec > 0 ? durationSec : undefined,
  };
}

/** Parse a list, skipping bad entries rather than failing the whole batch. */
export function parseShows(v: unknown): CatalogShow[] {
  if (!Array.isArray(v)) return [];
  return v.map(parseShow).filter((s): s is CatalogShow => s !== null);
}

export function parseEpisodes(v: unknown): CatalogEpisode[] {
  if (!Array.isArray(v)) return [];
  return v.map(parseEpisode).filter((e): e is CatalogEpisode => e !== null);
}
