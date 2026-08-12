import { describe, expect, it } from "vitest";
import { isLand } from "@/src/core/geo/landMask";

describe("isLand", () => {
  it("recognises well-known land points, away from coastlines", () => {
    expect(isLand(23, 10)).toBe(true); // Sahara
    expect(isLand(60, 90)).toBe(true); // central Russia
    expect(isLand(-25, 134)).toBe(true); // central Australia
    expect(isLand(-5, -60)).toBe(true); // Amazon basin
    expect(isLand(-85, 0)).toBe(true); // Antarctic ice
  });

  it("recognises well-known ocean points, away from coastlines", () => {
    expect(isLand(0, -160)).toBe(false); // mid-Pacific
    expect(isLand(0, -30)).toBe(false); // mid-Atlantic
    expect(isLand(-40, 80)).toBe(false); // southern Indian Ocean
    expect(isLand(45, -40)).toBe(false); // north Atlantic
  });

  it("clamps out-of-range input rather than throwing", () => {
    expect(() => isLand(999, 999)).not.toThrow();
    expect(() => isLand(-999, -999)).not.toThrow();
    expect(typeof isLand(999, 999)).toBe("boolean");
  });

  it("is false for non-finite input", () => {
    expect(isLand(NaN, 0)).toBe(false);
    expect(isLand(0, Infinity)).toBe(false);
  });
});
