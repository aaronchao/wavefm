/**
 * Deep-link OUT (Section 6): web URLs opened in a new tab. Stored URL when
 * known, else the app's web search for the show name so the icon still works.
 * A missing link with no fallback renders dimmed, never an error. PURE module.
 *
 * RSS-import note: Apple, Spotify, and 小宇宙 expose no *public web* add-by-RSS
 * URL — their RSS import is a native/mobile app-scheme flow, which can't open
 * reliably from a web tab, so those fall back to that app's web *search*. Only
 * YouTube Music has a real (if Google-undocumented — confirmed via podnews.net,
 * mirroring the old Google Podcasts subscribe-link scheme) direct add-by-RSS
 * URL: `music.youtube.com/library/podcasts?addrssfeed=<base64url(feedUrl)>`.
 * When a feed URL is available this is used instead of a search, so opening it
 * genuinely adds the show rather than landing on an empty/irrelevant search —
 * the RSS URL is still copied to the clipboard alongside it as a safety net in
 * case the undocumented parameter ever stops working. The show's raw feed is
 * always portable via the Library's OPML export for apps that do support
 * add-by-URL.
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
 * (1) the remembered preferred player's own link — real deep link, or its
 * search fallback if that's all it has, since honoring the user's actual
 * choice beats guessing a "better" platform for them; (2) any other real
 * link, only when the preferred player has no link at all (e.g. Pocket
 * Casts with no stored URL and no iTunes id); (3) null. The full icon row
 * (still rendered alongside) is the fallback for "just search" on anything
 * else. Apple's real link is present for nearly every catalog show, so an
 * earlier "any real link beats a search" rule effectively always won over
 * the remembered choice — defeating the point of remembering it.
 */
export function pickPreferredLink(
  links: PlatformLink[],
  preferred: PlatformId | null | undefined,
): PlatformLink | null {
  if (preferred) {
    const match = links.find((l) => l.id === preferred);
    if (match?.url) return match;
  }
  return links.find((l) => Boolean(l.url) && !l.isSearch) ?? null;
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
  /** The show's raw RSS feed — enables the real YouTube Music add-by-RSS deep link. */
  feedUrl?: string,
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
    // "YouTube", not "YouTube Music", whenever one is actually stored. Absent
    // that, a feed URL gets the real add-by-RSS deep link (see module doc)
    // instead of a plain search that would land on empty/irrelevant results.
    entry(
      "youtubeMusic",
      stored.youtubeMusic ? "YouTube" : "YouTube Music",
      feedUrl ? youtubeMusicAddByRssUrl(feedUrl) : `https://music.youtube.com/search?q=${q}`,
    ),
    pocketCasts(),
    entry("xiaoyuzhou", "小宇宙", `https://www.xiaoyuzhoufm.com/search/${q}`),
  ];
}
