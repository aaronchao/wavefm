import { describe, expect, it } from "vitest";
import { SCRUB_STEP, scrubTarget } from "@/src/core/wavr";

describe("scrubTarget", () => {
  it("returns the start index when the finger has not moved", () => {
    expect(scrubTarget({ dx: 0, startIndex: 4, count: 20 })).toBe(4);
  });

  it("detents once per step of travel", () => {
    expect(scrubTarget({ dx: SCRUB_STEP, startIndex: 0, count: 20 })).toBe(1);
    expect(scrubTarget({ dx: SCRUB_STEP * 3, startIndex: 0, count: 20 })).toBe(3);
    expect(scrubTarget({ dx: -SCRUB_STEP * 2, startIndex: 5, count: 20 })).toBe(3);
  });

  it("rounds to the nearest detent", () => {
    expect(scrubTarget({ dx: SCRUB_STEP * 0.49, startIndex: 0, count: 20 })).toBe(0);
    expect(scrubTarget({ dx: SCRUB_STEP * 0.51, startIndex: 0, count: 20 })).toBe(1);
  });

  it("clamps at both ends however far the finger travels", () => {
    expect(scrubTarget({ dx: 99999, startIndex: 5, count: 10 })).toBe(9);
    expect(scrubTarget({ dx: -99999, startIndex: 5, count: 10 })).toBe(0);
  });

  it("never returns an out-of-range index", () => {
    for (let dx = -2000; dx <= 2000; dx += 37) {
      for (const count of [1, 3, 12]) {
        const i = scrubTarget({ dx, startIndex: 1 % count, count });
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThanOrEqual(count - 1);
      }
    }
  });

  it("scrubs an empty deck to 0 rather than -1", () => {
    expect(scrubTarget({ dx: 500, startIndex: 0, count: 0 })).toBe(0);
  });

  it("honours a custom step", () => {
    expect(scrubTarget({ dx: 100, startIndex: 0, count: 20, step: 100 })).toBe(1);
  });
});
