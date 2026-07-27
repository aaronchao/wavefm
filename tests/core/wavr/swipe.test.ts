import { describe, expect, it } from "vitest";
import { commitDistance, decideSwipe, SWIPE } from "@/src/core/wavr";

const W = 380; // typical phone card width -> threshold 106.4px

describe("decideSwipe", () => {
  it("springs back when neither distance nor velocity commits", () => {
    expect(decideSwipe({ dx: 40, vx: 100, width: W })).toBe("return");
    expect(decideSwipe({ dx: -40, vx: -100, width: W })).toBe("return");
    expect(decideSwipe({ dx: 0, vx: 0, width: W })).toBe("return");
  });

  it("commits on distance past the ratio threshold", () => {
    expect(decideSwipe({ dx: 120, vx: 0, width: W })).toBe("save");
    expect(decideSwipe({ dx: -120, vx: 0, width: W })).toBe("skip");
  });

  it("does not commit exactly at the threshold", () => {
    const t = commitDistance(W);
    expect(decideSwipe({ dx: t, vx: 0, width: W })).toBe("return");
    expect(decideSwipe({ dx: t + 0.1, vx: 0, width: W })).toBe("save");
  });

  it("commits a fast short flick on velocity alone", () => {
    expect(decideSwipe({ dx: 20, vx: 900, width: W })).toBe("save");
    expect(decideSwipe({ dx: -20, vx: -900, width: W })).toBe("skip");
  });

  it("a slow long drag still commits", () => {
    expect(decideSwipe({ dx: 260, vx: 5, width: W })).toBe("save");
  });

  it("velocity wins the direction, so a flick back does not save", () => {
    // dragged slightly right, then thrown hard to the left
    expect(decideSwipe({ dx: 30, vx: -1200, width: W })).toBe("skip");
    expect(decideSwipe({ dx: -30, vx: 1200, width: W })).toBe("save");
  });

  it("applies the absolute floor on a narrow viewport", () => {
    // 280 * 0.28 = 78.4, below the 88px floor -> floor wins
    expect(commitDistance(280)).toBe(SWIPE.distanceMin);
    expect(decideSwipe({ dx: 80, vx: 0, width: 280 })).toBe("return");
    expect(decideSwipe({ dx: 95, vx: 0, width: 280 })).toBe("save");
  });

  it("uses the ratio on a wide viewport", () => {
    expect(commitDistance(1000)).toBe(280);
    expect(decideSwipe({ dx: 200, vx: 0, width: 1000 })).toBe("return");
  });
});
