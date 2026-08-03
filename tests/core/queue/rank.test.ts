import { describe, expect, it } from "vitest";
import { rankAtBottom, rankAtTop, rankBetween } from "@/src/core/queue/rank";

describe("rankAtTop", () => {
  it("sorts before every existing rank", () => {
    expect(rankAtTop([5, 2, 8])).toBeLessThan(2);
  });
  it("defaults to 0 for an empty queue", () => {
    expect(rankAtTop([])).toBe(0);
  });
});

describe("rankAtBottom", () => {
  it("sorts after every existing rank", () => {
    expect(rankAtBottom([5, 2, 8])).toBeGreaterThan(8);
  });
  it("defaults to 0 for an empty queue", () => {
    expect(rankAtBottom([])).toBe(0);
  });
});

describe("rankBetween", () => {
  it("averages two neighbors", () => {
    expect(rankBetween(2, 4)).toBe(3);
  });
  it("drops below a null lower neighbor (top of list)", () => {
    expect(rankBetween(null, 4)).toBeLessThan(4);
  });
  it("drops above a null upper neighbor (bottom of list)", () => {
    expect(rankBetween(2, null)).toBeGreaterThan(2);
  });
  it("returns 0 for an empty list", () => {
    expect(rankBetween(null, null)).toBe(0);
  });
});
