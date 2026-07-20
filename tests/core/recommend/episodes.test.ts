import { describe, expect, it } from "vitest";
import { rankEpisodes, type EpisodeInput } from "@/src/core/recommend";

const NOW = new Date("2026-07-12T00:00:00Z");
const ep = (over: Partial<EpisodeInput>): EpisodeInput => ({
  id: over.id ?? "x",
  title: over.title ?? "Ep",
  ...over,
});

describe("rankEpisodes", () => {
  it("puts a discussed episode above a merely-recent one (discussion-first)", () => {
    const ranked = rankEpisodes(
      [
        ep({ id: "recent", title: "Latest", publishedAt: "2026-07-11T00:00:00Z" }),
        ep({
          id: "discussed",
          title: "The famous one",
          publishedAt: "2024-01-01T00:00:00Z",
          discussion: { redditPosts: 40, redditComments: 500 },
        }),
      ],
      { now: NOW },
    );
    expect(ranked[0].episode.id).toBe("discussed");
    expect(ranked[0].basis).toBe("discussion");
    expect(ranked[0].why).toContain("Reddit");
  });

  it("ranks by rating when there's no discussion", () => {
    const ranked = rankEpisodes(
      [
        ep({ id: "recent", title: "Latest", publishedAt: "2026-07-11T00:00:00Z" }),
        ep({ id: "rated", title: "Acclaimed", rating: 9.4 }),
      ],
      { now: NOW },
    );
    expect(ranked[0].episode.id).toBe("rated");
    expect(ranked[0].basis).toBe("rating");
  });

  it("falls back to recency + substantive duration, labelled honestly", () => {
    const ranked = rankEpisodes(
      [
        ep({ id: "old", title: "Old", publishedAt: "2023-01-01T00:00:00Z", durationSec: 3000 }),
        ep({ id: "new", title: "New", publishedAt: "2026-07-10T00:00:00Z", durationSec: 3000 }),
        ep({ id: "trailer", title: "Trailer", publishedAt: "2026-07-11T00:00:00Z", durationSec: 60 }),
      ],
      { now: NOW },
    );
    expect(ranked[0].episode.id).toBe("new"); // recent + full-length beats a fresh trailer
    expect(ranked.every((r) => r.basis === "recent")).toBe(true);
    expect(ranked[0].why).toMatch(/week|Recent/);
  });

  it("is deterministic and respects the limit", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      ep({ id: `e${i}`, title: `Ep ${i}`, publishedAt: "2026-06-01T00:00:00Z", durationSec: 1800 }),
    );
    const a = rankEpisodes(many, { now: NOW, limit: 5 });
    const b = rankEpisodes([...many].reverse(), { now: NOW, limit: 5 });
    expect(a.map((r) => r.episode.id)).toEqual(b.map((r) => r.episode.id));
    expect(a).toHaveLength(5);
  });

  it("never throws on empty input", () => {
    expect(rankEpisodes([], { now: NOW })).toEqual([]);
  });
});
