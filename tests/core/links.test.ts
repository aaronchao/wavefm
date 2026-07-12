import { describe, expect, it } from "vitest";
import { platformLinks } from "@/src/core/links";

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

  it("returns null (dimmed chip) for Apple without a stored URL", () => {
    const apple = platformLinks("Some Show").find((l) => l.id === "apple")!;
    expect(apple.url).toBeNull();
  });

  it("always returns all four platforms in stable order", () => {
    expect(platformLinks("x").map((l) => l.id)).toEqual([
      "apple",
      "spotify",
      "youtubeMusic",
      "xiaoyuzhou",
    ]);
  });
});
