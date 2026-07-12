import { describe, expect, it } from "vitest";
import {
  buildIdf,
  cosine,
  l2Normalize,
  tokenize,
  vectorizeShow,
} from "@/src/core/recommend";
import { candidates } from "./fixtures";

describe("tokenize", () => {
  it("drops stopwords and keeps meaningful latin tokens", () => {
    expect(tokenize("The Psychology of a Podcast")).toEqual(["psychology"]);
  });

  it("emits CJK chars and bigrams so Chinese titles match", () => {
    expect(tokenize("周小辣")).toEqual(["周", "周小", "小", "小辣", "辣"]);
  });
});

describe("vectorizeShow", () => {
  const show = candidates[0]; // Psychology In Seattle

  it("is deterministic", () => {
    expect(vectorizeShow(show)).toEqual(vectorizeShow(show));
  });

  it("returns an L2-normalized vector", () => {
    const v = vectorizeShow(show);
    const norm = Math.sqrt(Object.values(v).reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 10);
  });

  it("weights category terms above description terms", () => {
    const v = vectorizeShow({
      id: "x",
      title: "Untitled",
      description: "travel",
      categories: ["books"],
    });
    expect(v["books"]).toBeGreaterThan(v["travel"]);
  });

  it("similar shows score higher than unrelated shows", () => {
    const idf = buildIdf(candidates);
    const psych = vectorizeShow(candidates[0], idf);
    const coaching = vectorizeShow(candidates[1], idf);
    const music = vectorizeShow(candidates[5], idf);
    expect(cosine(psych, coaching)).toBeGreaterThan(cosine(psych, music));
  });
});

describe("l2Normalize", () => {
  it("returns empty for a zero vector", () => {
    expect(l2Normalize({})).toEqual({});
  });
});
