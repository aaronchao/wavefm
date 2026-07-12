/**
 * Deep-link OUT (Section 6): web URLs opened in a new tab. Stored URL when
 * known, else a platform search URL for the show name. Apple has no search
 * fallback (its URL comes from iTunes or not at all) — a missing link
 * renders as a dimmed chip, never an error. PURE module.
 */

export type PlatformId = "apple" | "spotify" | "youtubeMusic" | "xiaoyuzhou";

export type PlatformLink = {
  id: PlatformId;
  label: string;
  /** Web URL to open, or null -> render the chip dimmed/disabled. */
  url: string | null;
  /** True when this is a search-for-title link rather than a stored URL. */
  isSearch: boolean;
};

export function platformLinks(
  title: string,
  stored: Partial<Record<PlatformId, string>> = {},
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
  return [
    entry("apple", "Apple Podcasts", null),
    entry("spotify", "Spotify", `https://open.spotify.com/search/${q}`),
    entry("youtubeMusic", "YouTube Music", `https://music.youtube.com/search?q=${q}`),
    entry("xiaoyuzhou", "小宇宙", `https://www.xiaoyuzhoufm.com/search/${q}`),
  ];
}
