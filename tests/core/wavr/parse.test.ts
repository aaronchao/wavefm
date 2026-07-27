import { describe, expect, it } from "vitest";
import { parseDiscussion } from "@/src/core/wavr/parse";

describe("parseDiscussion", () => {
  it("derives tags from the quote text and context tags", () => {
    const d = parseDiscussion(
      { source: "r/podcasts", text: "such a great psychology show" },
      ["storytelling"],
    );
    expect(Object.keys(d.tags)).toEqual(
      expect.arrayContaining(["great", "psychology", "storytelling"]),
    );
  });

  it("is L2-normalized", () => {
    const d = parseDiscussion({ source: "x", text: "psychology psychology grief" });
    const norm = Math.sqrt(Object.values(d.tags).reduce((s, w) => s + w * w, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("scores positive sentiment from a recommending quote", () => {
    const d = parseDiscussion({ source: "x", text: "this is my favorite, a total gem" });
    expect(d.sentiment).toBeGreaterThan(0);
  });

  it("scores negative sentiment from a trashing quote", () => {
    const d = parseDiscussion({ source: "x", text: "overrated and boring, skip it" });
    expect(d.sentiment).toBeLessThan(0);
  });

  it("detects recommendation intent from rec-seeking phrasing", () => {
    const d = parseDiscussion({ source: "x", text: "if you like true crime, recommend this one" });
    expect(d.intent).toBe("recommendation");
  });

  it("falls back to comention when there is no rec-intent phrasing", () => {
    const d = parseDiscussion({ source: "x", text: "also mentioned in the same thread" });
    expect(d.intent).toBe("comention");
  });

  it("is deterministic", () => {
    const a = parseDiscussion({ source: "x", text: "great storytelling podcast" }, ["culture"]);
    const b = parseDiscussion({ source: "x", text: "great storytelling podcast" }, ["culture"]);
    expect(a).toEqual(b);
  });
});
