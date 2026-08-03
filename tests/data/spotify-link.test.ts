import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Minimal fetch stub keyed by a per-URL handler (mirrors buzz-providers/ratings-ladder). */
function mockFetch(handler: (url: string, init?: RequestInit) => { ok?: boolean; body?: unknown }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const r = handler(url, init);
      const ok = r.ok ?? true;
      return { ok, status: ok ? 200 : 500, json: async () => r.body } as Response;
    }),
  );
}

function tokenAndSearch(showName: string | null) {
  return (url: string) => {
    if (url.includes("accounts.spotify.com")) {
      return { body: { access_token: "tok123", expires_in: 3600 } };
    }
    return {
      body: { shows: { items: showName ? [{ name: showName, external_urls: { spotify: "https://open.spotify.com/show/abc" } }] : [] } },
    };
  };
}

beforeEach(() => {
  vi.stubEnv("SPOTIFY_CLIENT_ID", "id");
  vi.stubEnv("SPOTIFY_CLIENT_SECRET", "secret");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("spotifyShowUrl", () => {
  it("returns the real show URL on a matching result", async () => {
    mockFetch(tokenAndSearch("Dear Therapist"));
    const { spotifyShowUrl, __resetSpotifyTokenCache } = await import("@/src/data/catalog/spotify");
    __resetSpotifyTokenCache();
    expect(await spotifyShowUrl("Dear Therapist")).toBe("https://open.spotify.com/show/abc");
  });

  it("returns null when no result matches the title", async () => {
    mockFetch(tokenAndSearch("A Totally Different Show"));
    const { spotifyShowUrl, __resetSpotifyTokenCache } = await import("@/src/data/catalog/spotify");
    __resetSpotifyTokenCache();
    expect(await spotifyShowUrl("Dear Therapist")).toBeNull();
  });

  it("returns null without configured credentials, and never calls fetch", async () => {
    vi.unstubAllEnvs();
    const spy = vi.fn();
    mockFetch(() => {
      spy();
      return { body: {} };
    });
    const { spotifyShowUrl, __resetSpotifyTokenCache } = await import("@/src/data/catalog/spotify");
    __resetSpotifyTokenCache();
    expect(await spotifyShowUrl("Anything")).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("never throws when the token request fails", async () => {
    mockFetch(() => ({ ok: false, body: {} }));
    const { spotifyShowUrl, __resetSpotifyTokenCache } = await import("@/src/data/catalog/spotify");
    __resetSpotifyTokenCache();
    expect(await spotifyShowUrl("Anything")).toBeNull();
  });

  it("never throws when the search request fails", async () => {
    mockFetch((url) =>
      url.includes("accounts.spotify.com")
        ? { body: { access_token: "tok123", expires_in: 3600 } }
        : { ok: false, body: {} },
    );
    const { spotifyShowUrl, __resetSpotifyTokenCache } = await import("@/src/data/catalog/spotify");
    __resetSpotifyTokenCache();
    expect(await spotifyShowUrl("Anything")).toBeNull();
  });
});
