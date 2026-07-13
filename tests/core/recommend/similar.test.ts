import { describe, expect, it } from "vitest";
import {
  queryTermsForShow,
  rankSimilar,
  type ShowInput,
  type SimilarItemInput,
} from "@/src/core/recommend";

const NOW = new Date("2026-07-12T00:00:00Z");

const seed: ShowInput = {
  id: "seed",
  title: "Dear Therapist",
  description: "A therapist works through real psychological case studies.",
  categories: ["Mental Health"],
};

const psych = (over: Partial<SimilarItemInput>): SimilarItemInput => ({
  id: "x",
  title: "Psych Twin",
  description: "Therapy and psychological case studies with a therapist.",
  categories: ["Mental Health"],
  ...over,
});

describe("rankSimilar", () => {
  it("ranks topically similar candidates above unrelated ones", () => {
    const ranked = rankSimilar(
      seed,
      [
        psych({ id: "close", title: "Psychology In Seattle" }),
        {
          id: "far",
          title: "Crypto Daily",
          description: "Bitcoin markets and trading.",
          categories: ["Business"],
        },
      ],
      { now: NOW },
    );
    expect(ranked.map((r) => r.item.id)).toEqual(["close", "far"]);
    expect(ranked[0].similarity).toBeGreaterThan(ranked[1].similarity);
  });

  it("is deterministic", () => {
    const candidates = [
      psych({ id: "a", title: "Alpha" }),
      psych({ id: "b", title: "Beta" }),
    ];
    const first = rankSimilar(seed, candidates, { now: NOW });
    const second = rankSimilar(seed, [...candidates].reverse(), { now: NOW });
    expect(first.map((r) => [r.item.id, r.score])).toEqual(
      second.map((r) => [r.item.id, r.score]),
    );
  });

  it("boosts an otherwise-identical candidate that charts", () => {
    const ranked = rankSimilar(
      seed,
      [
        psych({ id: "plain", title: "Twin A" }),
        psych({ id: "charting", title: "Twin B", chartRank: 3 }),
      ],
      { now: NOW },
    );
    expect(ranked[0].item.id).toBe("charting");
    expect(ranked[0].why).toContain("#3 on Apple charts");
  });

  it("treats missing metrics as neutral — unknown sits between good and bad", () => {
    const ranked = rankSimilar(
      seed,
      [
        psych({ id: "good", title: "Twin A", chartRank: 1 }),
        psych({ id: "unknown", title: "Twin B" }),
        psych({ id: "bad", title: "Twin C", chartRank: 100, episodeCount: 2 }),
      ],
      { now: NOW },
    );
    expect(ranked.map((r) => r.item.id)).toEqual(["good", "unknown", "bad"]);
    expect(ranked[1].popularity).toBe(0.5);
  });

  it("excludes the seed itself by id and by identical title", () => {
    const ranked = rankSimilar(
      seed,
      [
        psych({ id: "seed", title: "Same Id" }),
        psych({ id: "other", title: "  dear therapist " }),
        psych({ id: "keep", title: "Keeper" }),
      ],
      { now: NOW },
    );
    expect(ranked.map((r) => r.item.id)).toEqual(["keep"]);
  });

  it("respects the limit and sorts descending by score", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      psych({ id: `c${i}`, title: `Show ${i}`, episodeCount: (i + 1) * 20 }),
    );
    const ranked = rankSimilar(seed, many, { now: NOW, limit: 5 });
    expect(ranked).toHaveLength(5);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });

  it("writes human 'why' strings from recency and rating metrics", () => {
    const ranked = rankSimilar(
      seed,
      [
        psych({ id: "fresh", title: "Fresh", lastEpisodeAt: "2026-07-10T00:00:00Z" }),
        psych({
          id: "rated",
          title: "Rated",
          rating: 9.1,
          ratingSource: "douban",
        }),
      ],
      { now: NOW },
    );
    const byId = Object.fromEntries(ranked.map((r) => [r.item.id, r.why]));
    expect(byId.fresh).toContain("New this week");
    expect(byId.rated).toContain("Rated 9.1 on Douban");
    for (const r of ranked) expect(r.why).toMatch(/topics|flavor/);
  });

  it("never throws on empty candidates", () => {
    expect(rankSimilar(seed, [], { now: NOW })).toEqual([]);
  });
});

describe("queryTermsForShow", () => {
  it("returns top field-weighted terms, categories first", () => {
    const terms = queryTermsForShow(seed, 4);
    expect(terms).toContain("mental");
    expect(terms).toContain("health");
    expect(terms.length).toBeLessThanOrEqual(4);
  });

  it("skips single CJK characters in favor of bigrams", () => {
    const terms = queryTermsForShow(
      { id: "z", title: "周小辣", categories: [] },
      10,
    );
    expect(terms.every((t) => t.length > 1)).toBe(true);
    expect(terms).toContain("周小");
  });
});
