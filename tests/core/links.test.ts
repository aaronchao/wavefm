import { describe, expect, it } from "vitest";
import { itunesId, pickPreferredLink, platformLinks } from "@/src/core/links";

describe("platformLinks", () => {
  it("uses stored URLs when known", () => {
    const links = platformLinks("Dear Therapist", {
      apple: "https://podcasts.apple.com/us/podcast/id123",
    });
    const apple = links.find((l) => l.id === "apple")!;
    expect(apple.url).toBe("https://podcasts.apple.com/us/podcast/id123");
    expect(apple.isSearch).toBe(false);
  });

  it("falls back to platform search URLs for the show name", () => {
    const links = platformLinks("周小辣");
    const spotify = links.find((l) => l.id === "spotify")!;
    expect(spotify.url).toBe(
      "https://open.spotify.com/search/%E5%91%A8%E5%B0%8F%E8%BE%A3",
    );
    expect(spotify.isSearch).toBe(true);
  });

  it("falls back to Apple Podcasts web search when no URL is stored", () => {
    const apple = platformLinks("Some Show").find((l) => l.id === "apple")!;
    expect(apple.url).toBe("https://podcasts.apple.com/us/search?term=Some%20Show");
    expect(apple.isSearch).toBe(true);
  });

  it("labels YouTube Music's icon 'YouTube' once a real channel is resolved (REFINEMENTS.md #6)", () => {
    const withReal = platformLinks("Show", { youtubeMusic: "https://www.youtube.com/channel/abc" });
    expect(withReal.find((l) => l.id === "youtubeMusic")?.label).toBe("YouTube");
    const withoutReal = platformLinks("Show");
    expect(withoutReal.find((l) => l.id === "youtubeMusic")?.label).toBe("YouTube Music");
  });

  it("uses the real YouTube Music add-by-RSS deep link when a feed URL is available and no channel was resolved", () => {
    const yt = platformLinks(
      "周小辣",
      {},
      undefined,
      "https://example.com/feed.xml",
    ).find((l) => l.id === "youtubeMusic")!;
    expect(yt.url).toBe(
      "https://music.youtube.com/library/podcasts?addrssfeed=aHR0cHM6Ly9leGFtcGxlLmNvbS9mZWVkLnhtbA",
    );
    expect(yt.isSearch).toBe(true);
    expect(yt.label).toBe("YouTube Music");
  });

  it("prefers a resolved YouTube channel over the add-by-RSS deep link", () => {
    const yt = platformLinks(
      "Show",
      { youtubeMusic: "https://www.youtube.com/channel/abc" },
      undefined,
      "https://example.com/feed.xml",
    ).find((l) => l.id === "youtubeMusic")!;
    expect(yt.url).toBe("https://www.youtube.com/channel/abc");
    expect(yt.isSearch).toBe(false);
  });

  it("falls back to a plain YouTube Music search when there is no feed URL either", () => {
    const yt = platformLinks("Show").find((l) => l.id === "youtubeMusic")!;
    expect(yt.url).toBe("https://music.youtube.com/search?q=Show");
    expect(yt.isSearch).toBe(true);
  });

  it("always returns all platforms in stable order (Pocket Casts after YouTube Music)", () => {
    expect(platformLinks("x").map((l) => l.id)).toEqual([
      "apple",
      "spotify",
      "youtubeMusic",
      "pocketCasts",
      "xiaoyuzhou",
    ]);
  });

  it("builds a Pocket Casts deep link from an iTunes id (not a search)", () => {
    const pc = platformLinks("Some Show", {}, "1325018583").find((l) => l.id === "pocketCasts")!;
    expect(pc.url).toBe("https://pca.st/itunes/1325018583");
    expect(pc.isSearch).toBe(false);
  });

  it("prefers a stored Pocket Casts URL over the iTunes deep link", () => {
    const pc = platformLinks("Some Show", { pocketCasts: "https://pca.st/abcdef" }, "1325018583").find(
      (l) => l.id === "pocketCasts",
    )!;
    expect(pc.url).toBe("https://pca.st/abcdef");
  });

  it("dims Pocket Casts when there is neither a stored URL nor an iTunes id", () => {
    const pc = platformLinks("Some Show").find((l) => l.id === "pocketCasts")!;
    expect(pc.url).toBeNull();
    expect(pc.isSearch).toBe(false);
  });

  it("itunesId returns the id only for a numeric (iTunes-sourced) id", () => {
    expect(itunesId("1325018583")).toBe("1325018583");
    expect(itunesId("pi-42")).toBeUndefined();
    expect(itunesId("rss-abc123")).toBeUndefined();
    expect(itunesId(undefined)).toBeUndefined();
  });
});

describe("pickPreferredLink", () => {
  it("uses the preferred player when it has a real link", () => {
    const links = platformLinks("Show", { spotify: "https://open.spotify.com/show/abc" });
    expect(pickPreferredLink(links, "spotify")?.url).toBe("https://open.spotify.com/show/abc");
  });

  it("honors the preferred player's search fallback over a different platform's real link", () => {
    // Apple has a real link here, but the user explicitly chose Spotify —
    // that choice should win even though Spotify only resolves to a search.
    const links = platformLinks("Show", { apple: "https://podcasts.apple.com/us/podcast/id123" });
    const picked = pickPreferredLink(links, "spotify")!;
    expect(picked.id).toBe("spotify");
    expect(picked.isSearch).toBe(true);
  });

  it("falls back to any other real link when the preferred player has no link at all", () => {
    // Pocket Casts is the one platform that can resolve to a true null.
    const links = platformLinks("Show", { apple: "https://podcasts.apple.com/us/podcast/id123" });
    const picked = pickPreferredLink(links, "pocketCasts")!;
    expect(picked.id).toBe("apple");
    expect(picked.isSearch).toBe(false);
  });

  it("falls back to the preferred player's search link when nothing real exists at all", () => {
    const links = platformLinks("Show");
    const picked = pickPreferredLink(links, "spotify")!;
    expect(picked.id).toBe("spotify");
    expect(picked.isSearch).toBe(true);
  });

  it("returns null when there is no preference and nothing real exists", () => {
    expect(pickPreferredLink(platformLinks("Show"), null)).toBeNull();
  });

  it("returns a real link even with no preference set", () => {
    const links = platformLinks("Show", { apple: "https://podcasts.apple.com/us/podcast/id123" });
    expect(pickPreferredLink(links, null)?.id).toBe("apple");
  });
});
