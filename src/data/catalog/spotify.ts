import { titlesMatch } from "@/src/data/buzz/match";

/**
 * Resolves a real Spotify show URL (REFINEMENTS.md #5) — closes the same
 * one-click gap `pca.st` already closed for Pocket Casts. `platformLinks`
 * (src/core/links.ts) declares a `spotify` field, but nothing has ever
 * populated it; every Spotify icon has been a title-search fallback.
 *
 * Spotify's Client Credentials flow (free, app-only, no user login) is
 * enough for a public catalog search — no user auth required. Silently
 * returns null when SPOTIFY_CLIENT_ID/SECRET aren't configured
 * (NO_HARD_DEPS_ON_EXTERNAL_APIS) or on any request failure.
 */

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const SEARCH_URL = "https://api.spotify.com/v1/search";
const SEARCH_REVALIDATE_SECONDS = 7 * 24 * 60 * 60; // matches the ratings-cache TTL

let cachedToken: { value: string; expiresAt: number } | null = null;

/** Test seam — reset the in-process token cache. */
export function __resetSpotifyTokenCache() {
  cachedToken = null;
}

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  try {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store", // token endpoint — never cache the response itself
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return null;
    // Refresh a little early so a request never races an expiring token.
    const ttlMs = ((json.expires_in ?? 3600) - 60) * 1000;
    cachedToken = { value: json.access_token, expiresAt: Date.now() + ttlMs };
    return cachedToken.value;
  } catch {
    return null;
  }
}

type SpotifySearchResponse = {
  shows?: { items?: { name?: string; external_urls?: { spotify?: string } }[] };
};

/** The show's real Spotify page URL, or null if unavailable/unconfigured/no match. */
export async function spotifyShowUrl(title: string): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;
  try {
    const url = `${SEARCH_URL}?type=show&limit=5&q=${encodeURIComponent(title)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: SEARCH_REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as SpotifySearchResponse;
    const items = json.shows?.items ?? [];
    const match = items.find((item) => item.name && titlesMatch(title, item.name));
    return match?.external_urls?.spotify ?? null;
  } catch {
    return null;
  }
}
