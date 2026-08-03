/**
 * Deep-link OUT (Section 6): web URLs opened in a new tab. Stored URL when
 * known, else the app's web search for the show name so the icon still works.
 * A missing link with no fallback renders dimmed, never an error. PURE module.
 *
 * RSS-import note: none of Apple, Spotify, YouTube Music, or 小宇宙 expose a
 * *public web* add-by-URL flow for LISTENING, so every icon here is "search
 * for it, tap play yourself" when no real deep link is known — never a
 * surprise "add/subscribe" action standing in for "listen" (that bait-and-
 * switch was tried for YouTube Music and reported unusable: tapping "Listen"
 * shouldn't open a subscribe-confirmation dialog with nothing playable).
 *
 * YouTube Music does separately have a real (if Google-undocumented —
 * confirmed via podnews.net, mirroring the old Google Podcasts subscribe-
 * link scheme) add-by-RSS URL: `music.youtube.com/library/podcasts
 * ?addrssfeed=<base64url(feedUrl)>` — see `youtubeMusicAddByRssUrl`. That's
 * exposed only as an explicit, separately-labeled "add" action (the Library
 * bulk-add panel, and a small opt-in control next to the icon), never as
 * the icon's own click target. The show's raw feed is always portable via
 * the Library's OPML export for apps that support add-by-URL for real.
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

/** Base64URL (RFC 4648 §5) of a URL — always ASCII, so `btoa` is safe. */
function base64Url(value: string): string {
  const base64 =
    typeof btoa === "function" ? btoa(value) : Buffer.from(value, "utf-8").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * YouTube Music's real (if Google-undocumented) add-by-RSS deep link for a
 * feed — see the module doc above. Exported so a bulk "add all my shows"
 * flow can build one per saved show without duplicating the encoding.
 */
export function youtubeMusicAddByRssUrl(feedUrl: string): string {
  return `https://music.youtube.com/library/podcasts?addrssfeed=${base64Url(feedUrl)}`;
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
