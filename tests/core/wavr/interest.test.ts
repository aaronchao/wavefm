import { describe, expect, it } from "vitest";
import { interestProfile } from "@/src/core/wavr";

const SHOW_TAGS = {
  s1: ["psychology", "therapy"],
  s2: ["true crime"],
};

function l2(v: Record<string, number>): number {
  return Math.sqrt(Object.values(v).reduce((a, b) => a + b * b, 0));
}

describe("interestProfile", () => {
  it("is L2-normalized, which is what cosine() assumes", () => {
    const p = interestProfile(["psychology"], [], SHOW_TAGS);
    expect(l2(p)).toBeCloseTo(1, 10);
  });

  it("returns an empty vector when there is nothing to go on", () => {
    expect(interestProfile([], [], SHOW_TAGS)).toEqual({});
  });

  it("an empty history leaves the declared interests alone", () => {
    const declared = interestProfile(["psychology"], [], SHOW_TAGS);
    const withUnknownShow = interestProfile(
      ["psychology"],
      [{ showId: "unknown", type: "save" }],
      SHOW_TAGS,
    );
    expect(withUnknownShow).toEqual(declared);
  });

  it("a save raises the engaged show's tags", () => {
    const before = interestProfile(["true crime"], [], SHOW_TAGS);
    const after = interestProfile(
      ["true crime"],
      [{ showId: "s1", type: "save" }],
      SHOW_TAGS,
    );
    expect(after.psychology).toBeGreaterThan(before.psychology ?? 0);
  });

  it("a block lowers the blocked show's tags", () => {
    const interests = ["psychology", "true crime"];
    const base = interestProfile(
      interests,
      [{ showId: "s1", type: "save" }],
      SHOW_TAGS,
    );
    const blocked = interestProfile(
      interests,
      [
        { showId: "s1", type: "save" },
        { showId: "s1", type: "block" },
      ],
      SHOW_TAGS,
    );
    // psychology is pushed down relative to the untouched true-crime tags
    expect(base.psychology).toBeGreaterThan(0);
    expect(blocked.psychology / blocked.crime).toBeLessThan(
      base.psychology / base.crime,
    );
  });

  it("a single block can zero out a tag that was only a declared interest", () => {
    const base = interestProfile(["psychology"], [], SHOW_TAGS);
    const blocked = interestProfile(
      ["psychology"],
      [{ showId: "s1", type: "block" }],
      SHOW_TAGS,
    );
    expect(base.psychology).toBeGreaterThan(0);
    expect(blocked.psychology ?? 0).toBe(0);
  });

  it("clamps a heavily blocked tag to zero rather than flipping it negative", () => {
    const p = interestProfile(
      ["psychology"],
      [
        { showId: "s1", type: "block" },
        { showId: "s1", type: "block" },
      ],
      SHOW_TAGS,
    );
    for (const term in p) expect(p[term]).toBeGreaterThanOrEqual(0);
    expect(p.therapy ?? 0).toBe(0);
  });

  it("is deterministic", () => {
    const run = () =>
      interestProfile(["psychology"], [{ showId: "s1", type: "save" }], SHOW_TAGS);
    expect(run()).toEqual(run());
  });
});
