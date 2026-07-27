import { describe, expect, it } from "vitest";
import { planRing, RING_SIZE, slotFor } from "@/src/core/wavr/ring";

const roleSlot = (count: number, index: number) =>
  Object.fromEntries(planRing(count, index).map((a) => [a.role, a.slot]));

describe("planRing", () => {
  it("always puts prev, cur and next on three different slots", () => {
    for (let index = 0; index < 12; index++) {
      const slots = planRing(20, index).map((a) => a.slot);
      expect(new Set(slots).size).toBe(RING_SIZE);
    }
  });

  it("keeps every slot in range", () => {
    for (let index = 0; index < 12; index++) {
      for (const a of planRing(20, index)) {
        expect(a.slot).toBeGreaterThanOrEqual(0);
        expect(a.slot).toBeLessThan(RING_SIZE);
      }
    }
  });

  it("hands the outgoing element straight to prev — this is what makes undo instant", () => {
    for (let index = 0; index < 12; index++) {
      const before = roleSlot(20, index);
      const after = roleSlot(20, index + 1);
      // the element that was playing keeps its src and becomes prev
      expect(after.prev).toBe(before.cur);
      // and the card ahead was already hot-parked where cur now points
      expect(after.cur).toBe(before.next);
    }
  });

  it("frees exactly the slot two cards back for the next prime", () => {
    const before = roleSlot(20, 5);
    const after = roleSlot(20, 6);
    expect(after.next).toBe(before.prev);
  });

  it("marks the ends unoccupied instead of running off the deck", () => {
    const first = planRing(3, 0);
    expect(first.find((a) => a.role === "prev")?.occupied).toBe(false);
    expect(first.find((a) => a.role === "cur")?.occupied).toBe(true);
    expect(first.find((a) => a.role === "next")?.occupied).toBe(true);

    const last = planRing(3, 2);
    expect(last.find((a) => a.role === "next")?.occupied).toBe(false);
    expect(last.find((a) => a.role === "prev")?.occupied).toBe(true);
  });

  it("handles an empty deck without throwing", () => {
    for (const a of planRing(0, 0)) expect(a.occupied).toBe(false);
  });

  it("slotFor agrees with planRing", () => {
    for (let index = 0; index < 8; index++) {
      for (const a of planRing(20, index)) {
        expect(slotFor(index, a.role)).toBe(a.slot);
      }
    }
  });
});
