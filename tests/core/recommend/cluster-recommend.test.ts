import { describe, expect, it } from "vitest";
import {
  cluster,
  diversify,
  recommend,
  vectorizeShow,
  buildIdf,
  type Cluster,
  type ScoredCandidate,
} from "@/src/core/recommend";
import { candidates, engagements, NOW, savedShows } from "./fixtures";

const idf = buildIdf([...candidates, ...savedShows]);
const scored = (id: string, score = 1): ScoredCandidate => {
  const show = candidates.find((c) => c.id === id)!;
  return { show, vector: vectorizeShow(show, idf), score };
};

describe("cluster", () => {
  it("assigns psych shows to the seed cluster with 'More …' why copy", () => {
    const clusters = cluster([scored("c-psychseattle")]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].label).toBe("psychological case studies");
    expect(clusters[0].why).toBe("More psychological case studies");
  });

  it("groups shows similar to a saved show as 'Because you saved …'", () => {
    const saved = {
      show: savedShows[1], // 周小辣
      vector: vectorizeShow(savedShows[1], idf),
    };
    const clusters = cluster([scored("c-sono")], { saved: [saved] });
    expect(clusters[0].why).toBe("Because you saved 周小辣");
  });

  it("labels highly rated discoveries with the rating source", () => {
    const item = { ...scored("c-highlyrated"), rating: { source: "douban", rating: 9.2 } };
    const clusters = cluster([item]);
    expect(clusters[0].why).toBe("Highly rated on Douban");
  });

  it("falls back to the top category", () => {
    const clusters = cluster([scored("c-zane")]);
    expect(clusters[0].label).toBe("Music");
    expect(clusters[0].why).toBe("More Music");
  });
});

describe("diversify", () => {
  it("caps items per cluster and orders clusters by best item", () => {
    const big: Cluster = {
      id: "a",
      label: "A",
      why: "More A",
      items: [scored("c-books", 0.1), scored("c-zane", 0.9), scored("c-sono", 0.5)],
    };
    const small: Cluster = {
      id: "b",
      label: "B",
      why: "More B",
      items: [scored("c-gaytravel", 0.95)],
    };
    const out = diversify([big, small], { perCluster: 2 });
    expect(out[0].id).toBe("b"); // 0.95 beats 0.9
    expect(out[1].items.map((i) => i.show.id)).toEqual(["c-zane", "c-sono"]);
  });

  it("drops empty clusters", () => {
    expect(diversify([{ id: "x", label: "X", why: "", items: [] }])).toEqual([]);
  });
});

describe("recommend (full pipeline)", () => {
  const input = {
    candidates,
    engagements,
    engagedShows: savedShows,
    interests: ["book discussions"],
    ratings: { "c-highlyrated": { source: "douban", rating: 9.2 } },
    impressions: { "c-zane": 3 },
    now: NOW,
  };

  it("is deterministic — same input, deep-equal output", () => {
    expect(recommend(input)).toEqual(recommend(input));
  });

  it("excludes blocked and already-saved shows", () => {
    const ids = recommend(input)
      .flatMap((c) => c.items)
      .map((i) => i.show.id);
    expect(ids).not.toContain("c-blocked");
    expect(ids).not.toContain("s-therapist");
  });

  it("every cluster carries a human 'why'", () => {
    for (const c of recommend(input)) {
      expect(c.why.length).toBeGreaterThan(0);
    }
  });

  it("surfaces psych shows near the top for this taste", () => {
    const clusters = recommend(input);
    const flat = clusters.flatMap((c) => c.items).map((i) => i.show.id);
    expect(flat.indexOf("c-psychseattle")).toBeLessThan(
      flat.indexOf("c-zane"),
    );
  });

  it("produces stable scores for the fixture set", () => {
    const clusters = recommend(input);
    const psych = clusters
      .flatMap((c) => c.items)
      .find((i) => i.show.id === "c-psychseattle")!;
    // pin the exact value so accidental algorithm drift fails loudly
    expect(psych.score).toBeCloseTo(0.30620210641999546, 12);
  });
});
