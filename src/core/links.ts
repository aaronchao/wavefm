/**
 * Deep-link OUT (Section 6): web URLs opened in a new tab. Stored URL when
 * known, else the app's web search for the show name so the icon still works.
 * A missing link with no fallback renders dimmed, never an error. PURE module.
 *
 * RSS-import note: the four consumer apps we link to (Apple, Spotify, YouTube
 * Music, 小宇宙) expose no *public web* add-by-RSS URL — their RSS import is a
 * native/mobile app-scheme flow, which can't open reliably from a web tab. So
 * when a show isn't on an app we fall back to that app's web *search* (the
 * closest working equivalent); the show's raw feed is always portable via the
 * Library's OPML export for apps that do support add-by-URL.
 */

export type PlatformId =
  | "apple"
  | "spotify"
  | "youtubeMusic"
  | "pocketCasts"
  | "xiaoyuzhou";

export type PlatformLink = {
  id: PlatformId;
  label: string;
  /** Web URL to open, or null -> render the icon dimmed/disabled. */
  url: string | null;
  /** True when this is a search-for-title link rather than a stored URL. */
  isSearch: boolean;
};

/**
 * The numeric iTunes id, if `id` is one (iTunes-sourced shows carry the
 * collectionId as their id; Podcast-Index/RSS shows use `pi-`/`rss-` prefixes
 * and return undefined). Used to build a Pocket Casts deep link.
 */
export function itunesId(id: string | undefined): string | undefined {
  return id && /^\d+$/.test(id) ? id : undefined;
}

/**
 * The one-tap "▶ Listen" primary action (REFINEMENTS.md #4). Priority:
 * (1) the remembered preferred player, if it has a real (non-search) link;
 * (2) any other real link, next-best — a genuine deep link beats a search
 * even for the "wrong" platform; (3) the preferred player's link even if
 * it's search-only, as a last resort before giving up; (4) null. The full
 * icon row (still rendered alongside) is the fallback for "just search".
 */
export function pickPreferredLink(
  links: PlatformLink[],
  preferred: PlatformId | null | undefined,
): PlatformLink | null {
  const isReal = (l: PlatformLink) => Boolean(l.url) && !l.isSearch;
  if (preferred) {
    const match = links.find((l) => l.id === preferred);
    if (match && isReal(match)) return match;
  }
  const nextBest = links.find(isReal);
  if (nextBest) return nextBest;
  if (preferred) {
    const match = links.find((l) => l.id === preferred && l.url);
    if (match) return match;
  }
  return null;
}

export function platformLinks(
  title: string,
  stored: Partial<Record<PlatformId, string>> = {},
  itunes?: string,
): PlatformLink[] {
  const q = encodeURIComponent(title);
  const entry = (
    id: PlatformId,
    label: string,
    searchUrl: string | null,
  ): PlatformLink => {
    const storedUrl = stored[id];
    if (storedUrl) return { id, label, url: storedUrl, isSearch: false };
    return { id, label, url: searchUrl, isSearch: searchUrl !== null };
  };
  // Pocket Casts has no public title-search web URL, but `pca.st/itunes/<id>`
  // deep-links straight to the show (and opens the app on mobile). So a stored
  // URL or an iTunes id both give a real link; without either, the icon dims.
  const pocketCasts = (): PlatformLink => {
    if (stored.pocketCasts)
      return { id: "pocketCasts", label: "Pocket Casts", url: stored.pocketCasts, isSearch: false };
    if (itunes)
      return { id: "pocketCasts", label: "Pocket Casts", url: `https://pca.st/itunes/${itunes}`, isSearch: false };
    return { id: "pocketCasts", label: "Pocket Casts", url: null, isSearch: false };
  };
  return [
    entry("apple", "Apple Podcasts", `https://podcasts.apple.com/us/search?term=${q}`),
    entry("spotify", "Spotify", `https://open.spotify.com/search/${q}`),
    // A resolved stored link is never verifiably on the Music app itself
    // (YouTube Music has no public show-search API) — it's a real YouTube
    // channel found via video search (REFINEMENTS.md #6), so it's labelled
    // "YouTube", not "YouTube Music", whenever one is actually stored.
    entry(
      "youtubeMusic",
      stored.youtubeMusic ? "YouTube" : "YouTube Music",
      `https://music.youtube.com/search?q=${q}`,
    ),
    pocketCasts(),
    entry("xiaoyuzhou", "小宇宙", `https://www.xiaoyuzhoufm.com/search/${q}`),
  ];
}
