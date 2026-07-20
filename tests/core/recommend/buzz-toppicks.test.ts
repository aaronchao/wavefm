import { describe, expect, it } from "vitest";
import {
  buzzScore,
  buzzWhy,
  rankSimilar,
  topPicks,
  type ShowInput,
  type SimilarItemInput,
} from "@/src/core/recommend";

const NOW = new Date("2026-07-12T00:00:00Z");

describe("buzzScore", () => {
  it("returns null when nothing is known", () => {
    expect(buzzScore(undefined)).toBeNull();
    expect(buzzScore({})).toBeNull();
  });

  it("scores 0..1 and grows with discussion volume", () => {
    const quiet = buzzScore({ redditPosts: 1, redditScore: 2 })!;
    const loud = buzzScore({ redditPosts: 80, redditScore: 4000, redditComments: 900 })!;
    expect(quiet).toBeGreaterThan(0);
    expect(loud).toBeGreaterThan(quiet);
    expect(loud).toBeLessThanOrEqual(1);
  });

  it("ranks a top 中文播客榜 show near 1", () => {
    expect(buzzScore({ xyzrankRank: 1 })!).toBeCloseTo(1);
    expect(buzzScore({ xyzrankRank: 200 })!).toBeLessThan(0.01);
  });

  it("weights human discussion above raw popularity within a show", () => {
    // strong 小宇宙 comments (discussion≈1), worst chart rank (popularity≈0)
    const s = buzzScore({ comments: 10000, xyzrankRank: 200 })!;
    expect(s).toBeGreaterThan(0.6); // 0.65·1 + 0.35·~0; a 50/50 blend would be ~0.5
  });

  it("leads the 'why' with a discussion source over a popularity one", () => {
    expect(buzzWhy({ redditPosts: 9, xyzrankRank: 2, listenScore: 90 })).toContain("Reddit");
  });

  it("uses Listen Notes' Listen Score (0..100)", () => {
    expect(buzzScore({ listenScore: 90 })!).toBeCloseTo(0.9);
    expect(buzzScore({ listenScore: 0 })!).toBe(0);
    expect(buzzWhy({ listenScore: 72 })).toBe("Popular podcast (Listen Score 72)");
    expect(buzzWhy({ listenScore: 20 })).toBeNull();
  });

  it("writes human why phrases per source", () => {
    expect(buzzWhy({ xyzrankRank: 12 })).toBe("#12 on 中文播客榜");
    expect(buzzWhy({ redditPosts: 9 })).toContain("Reddit");
    expect(buzzWhy({ subscribers: 52_000 })).toContain("小宇宙");
    expect(buzzWhy({ redditPosts: 1 })).toBeNull();
  });
});

const seed: ShowInput = {
  id: "seed",
  title: "Dear Therapist",
  description: "Psychological case studies with a therapist.",
  categories: ["Mental Health"],
};

const cand = (over: Partial<SimilarItemInput>): SimilarItemInput => ({
  id: "x",
  title: "X",
  description: "Therapy and psychological case studies.",
  categories: ["Mental Health"],
  ...over,
});

describe("buzz inside rankSimilar", () => {
  it("boosts an otherwise-identical candidate with strong discussion", () => {
    const ranked = rankSimilar(
      seed,
      [
        cand({ id: "quiet", title: "Twin A" }),
        cand({ id: "buzzy", title: "Twin B", buzz: { xyzrankRank: 3 } }),
      ],
      { now: NOW },
    );
    expect(ranked[0].item.id).toBe("buzzy");
    expect(ranked[0].why).toContain("中文播客榜");
  });
});

describe("topPicks", () => {
  const saved: ShowInput[] = [seed];

  it("prefers high-quality shows that also match taste", () => {
    const picks = topPicks({
      saved,
      candidates: [
        cand({ id: "match-rated", title: "Therapy Lab", rating: 9, chartRank: 5 }),
        cand({ id: "match-unknown", title: "Therapy Chat" }),
        cand({
          id: "offtaste-rated",
          title: "Crypto Hour",
          description: "Bitcoin markets and trading.",
          categories: ["Business"],
          rating: 9,
          chartRank: 5,
        }),
      ],
      now: NOW,
    });
    expect(picks[0].item.id).toBe("match-rated");
    expect(picks[0].why).toContain("matches your taste");
    const ids = picks.map((p) => p.item.id);
    expect(ids.indexOf("match-rated")).toBeLessThan(ids.indexOf("match-unknown"));
  });

  it("never recommends what's already saved (by id or title)", () => {
    const picks = topPicks({
      saved,
      candidates: [
        cand({ id: "seed", title: "Same Id" }),
        cand({ id: "other", title: "DEAR THERAPIST " }),
        cand({ id: "keep", title: "Keeper" }),
      ],
      now: NOW,
    });
    expect(picks.map((p) => p.item.id)).toEqual(["keep"]);
  });

  it("works with no saved shows: pure quality ranking, neutral affinity", () => {
    const picks = topPicks({
      saved: [],
      candidates: [
        cand({ id: "great", title: "A", rating: 9.5, buzz: { xyzrankRank: 2 } }),
        cand({ id: "meh", title: "B", rating: 5 }),
      ],
      now: NOW,
    });
    expect(picks.map((p) => p.item.id)).toEqual(["great", "meh"]);
    expect(picks[0].affinity).toBe(0.5);
    expect(picks[0].why).not.toContain("matches your taste");
  });

  it("is deterministic and respects the limit", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      cand({ id: `c${i}`, title: `Show ${i}`, rating: 5 + (i % 5) }),
    );
    const a = topPicks({ saved, candidates: many, now: NOW, limit: 6 });
    const b = topPicks({ saved, candidates: [...many].reverse(), now: NOW, limit: 6 });
    expect(a.map((p) => p.item.id)).toEqual(b.map((p) => p.item.id));
    expect(a).toHaveLength(6);
  });
});
