import { describe, expect, it } from "vitest";
import {
  buildIdf,
  cosine,
  scoreCandidate,
  tasteVector,
  vectorizeShow,
  type SparseVector,
} from "@/src/core/recommend";
import { candidates, savedShows } from "./fixtures";

const idf = buildIdf([...candidates, ...savedShows]);
const vecs: Record<string, SparseVector> = {};
for (const s of [...candidates, ...savedShows]) vecs[s.id] = vectorizeShow(s, idf);

describe("tasteVector", () => {
  it("pulls taste toward saved shows' topics", () => {
    const taste = tasteVector(
      [{ showId: "s-therapist", type: "save" }],
      vecs,
    );
    expect(cosine(taste, vecs["c-psychseattle"])).toBeGreaterThan(
      cosine(taste, vecs["c-zane"]),
    );
  });

  it("blocking pushes taste away from a topic", () => {
    const savedOnly = tasteVector([{ showId: "s-therapist", type: "save" }], vecs);
    const withBlock = tasteVector(
      [
        { showId: "s-therapist", type: "save" },
        { showId: "c-highlyrated", type: "block" },
      ],
      vecs,
    );
    expect(cosine(withBlock, vecs["c-highlyrated"])).toBeLessThan(
      cosine(savedOnly, vecs["c-highlyrated"]),
    );
  });

  it("interest picks alone produce a usable taste (cold start)", () => {
    const taste = tasteVector([], vecs, ["book discussions"]);
    expect(cosine(taste, vecs["c-books"])).toBeGreaterThan(
      cosine(taste, vecs["c-zane"]),
    );
  });

  it("ignores engagements for unknown shows", () => {
    expect(tasteVector([{ showId: "nope", type: "save" }], vecs)).toEqual({});
  });
});

describe("scoreCandidate", () => {
  const taste = tasteVector([{ showId: "s-therapist", type: "save" }], vecs);
  const show = vecs["c-psychseattle"];
  const base = scoreCandidate(taste, show);

  it("missing rating is neutral", () => {
    expect(scoreCandidate(taste, show, { rating: null })).toBe(base);
  });

  it("adds λ·normRating for rated shows", () => {
    expect(scoreCandidate(taste, show, { rating: 10 })).toBeCloseTo(
      base + 0.15,
      10,
    );
  });

  it("adds freshness bonus for recently active shows", () => {
    expect(scoreCandidate(taste, show, { daysSinceLastEpisode: 3 })).toBeCloseTo(
      base + 0.1,
      10,
    );
    expect(
      scoreCandidate(taste, show, { daysSinceLastEpisode: 20 }),
    ).toBeCloseTo(base + 0.05, 10);
    expect(
      scoreCandidate(taste, show, { daysSinceLastEpisode: 200 }),
    ).toBe(base);
  });

  it("subtracts capped fatigue for repeated impressions", () => {
    expect(scoreCandidate(taste, show, { recentImpressions: 2 })).toBeCloseTo(
      base - 0.1,
      10,
    );
    expect(
      scoreCandidate(taste, show, { recentImpressions: 100 }),
    ).toBeCloseTo(base - 0.25, 10); // capped at 5
  });
});
