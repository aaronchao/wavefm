import { describe, expect, it } from "vitest";
import { itunesId, platformLinks, youtubeMusicAddByRssUrl } from "@/src/core/links";

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

  it("falls back to a plain YouTube Music search when no channel was resolved", () => {
    const yt = platformLinks("Show").find((l) => l.id === "youtubeMusic")!;
    expect(yt.url).toBe("https://music.youtube.com/search?q=Show");
    expect(yt.isSearch).toBe(true);
  });

  it("youtubeMusicAddByRssUrl base64url-encodes the feed (used by the bulk-add panel too)", () => {
    expect(youtubeMusicAddByRssUrl("https://example.com/feed.xml")).toBe(
      "https://music.youtube.com/library/podcasts?addrssfeed=aHR0cHM6Ly9leGFtcGxlLmNvbS9mZWVkLnhtbA",
    );
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
