import { describe, expect, it } from "vitest";
import { extraTopicsFor } from "@/src/features/explore/useRecommendations";

describe("extraTopicsFor (REFINEMENTS.md #16 — over-fetch proportional to blocks)", () => {
  it("adds nothing for a light or no block history", () => {
    expect(extraTopicsFor(0)).toBe(0);
    expect(extraTopicsFor(4)).toBe(0);
  });

  it("adds one extra topic per 5 blocks", () => {
    expect(extraTopicsFor(5)).toBe(1);
    expect(extraTopicsFor(24)).toBe(4);
  });

  it("caps at 6 extra topics for a heavily-blocked user", () => {
    expect(extraTopicsFor(100)).toBe(6);
  });
});
