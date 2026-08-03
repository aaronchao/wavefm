import { describe, expect, it } from "vitest";
import {
  rankAfterAdjacentMove,
  rankAtBottom,
  rankAtTop,
  rankBetween,
  rankForIndex,
} from "@/src/core/queue/rank";

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

describe("rankAfterAdjacentMove", () => {
  it("moving down swaps with the next item (ends up right after it)", () => {
    const ranks = [0, 1, 2];
    const rank = rankAfterAdjacentMove(ranks, 1, "down")!; // move B past C
    expect(rank).toBeGreaterThan(2);
  });
  it("moving up swaps with the previous item (ends up right before it)", () => {
    const ranks = [0, 1, 2];
    const rank = rankAfterAdjacentMove(ranks, 2, "up")!; // move C past B
    expect(rank).toBeGreaterThan(0);
    expect(rank).toBeLessThan(1);
  });
  it("returns null moving up from the top", () => {
    expect(rankAfterAdjacentMove([0, 1, 2], 0, "up")).toBeNull();
  });
  it("returns null moving down from the bottom", () => {
    expect(rankAfterAdjacentMove([0, 1, 2], 2, "down")).toBeNull();
  });
});

describe("rankForIndex", () => {
  it("drops at index 0 to sort before everything", () => {
    expect(rankForIndex([2, 4, 6], 0)).toBeLessThan(2);
  });
  it("drops at the end to sort after everything", () => {
    expect(rankForIndex([2, 4, 6], 3)).toBeGreaterThan(6);
  });
  it("drops in the middle, between its new neighbors", () => {
    const rank = rankForIndex([2, 4, 6], 1);
    expect(rank).toBeGreaterThan(2);
    expect(rank).toBeLessThan(4);
  });
  it("handles an empty queue (dropping in from Inbox with nothing queued yet)", () => {
    expect(rankForIndex([], 0)).toBe(0);
  });
});
