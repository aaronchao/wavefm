import { describe, expect, it } from "vitest";
import { buildDeck, type WavrCard } from "@/src/core/wavr";
import { deckReducer, initialDeckState } from "@/src/core/wavr/deckReducer";
import { candidate, resetIds, tags } from "./fixtures";

function makeDeck(n: number): WavrCard[] {
  resetIds();
  const profile = tags({ psychology: 1 });
  return buildDeck(
    Array.from({ length: n }, () => candidate()),
    profile,
    { maxPerShow: n, dominantTagCap: 1 },
  );
}

describe("deckReducer", () => {
  it("decide sets flying but does not advance index", () => {
    const queue = makeDeck(3);
    const s1 = deckReducer(initialDeckState(queue), {
      t: "decide",
      card: queue[0],
      decision: "save",
      dir: 1,
    });
    expect(s1.index).toBe(0);
    expect(s1.flying).toEqual({ id: queue[0].id, dir: 1 });
    expect(s1.decided).toEqual([{ card: queue[0], decision: "save" }]);
    expect(s1.undoable?.card.id).toBe(queue[0].id);
  });

  it("flownOut advances index and clears flying", () => {
    const queue = makeDeck(2);
    let s = initialDeckState(queue);
    s = deckReducer(s, { t: "decide", card: queue[0], decision: "skip", dir: -1 });
    s = deckReducer(s, { t: "flownOut" });
    expect(s.index).toBe(1);
    expect(s.flying).toBeNull();
  });

  it("undo before flownOut does not double-decrement", () => {
    const queue = makeDeck(2);
    let s = initialDeckState(queue);
    s = deckReducer(s, { t: "decide", card: queue[0], decision: "save", dir: 1 });
    s = deckReducer(s, { t: "undo" });
    expect(s.index).toBe(0);
    expect(s.decided).toEqual([]);
    expect(s.undoable).toBeNull();
  });

  it("undo after flownOut steps index back", () => {
    const queue = makeDeck(2);
    let s = initialDeckState(queue);
    s = deckReducer(s, { t: "decide", card: queue[0], decision: "save", dir: 1 });
    s = deckReducer(s, { t: "flownOut" });
    s = deckReducer(s, { t: "undo" });
    expect(s.index).toBe(0);
    expect(s.decided).toEqual([]);
  });

  it("undo with no undoable is a no-op", () => {
    const queue = makeDeck(1);
    const s0 = initialDeckState(queue);
    const s1 = deckReducer(s0, { t: "undo" });
    expect(s1).toBe(s0);
  });

  it("jump preserves length and membership; passed-over cards stay behind the picked one", () => {
    const queue = makeDeck(6);
    let s = initialDeckState(queue);
    s = { ...s, index: 2 }; // sitting on card[2]
    s = deckReducer(s, { t: "openOverview" });
    s = deckReducer(s, { t: "jump", to: 5 }); // pick the far card

    const before = [...queue].map((c) => c.id).sort();
    const after = [...s.queue].map((c) => c.id).sort();
    expect(after).toEqual(before); // anti-data-loss: same membership

    expect(s.queue[2].id).toBe(queue[5].id); // picked card now sits at `index`
    // cards passed over (2, 3, 4) keep their relative order directly behind it
    expect(s.queue[3].id).toBe(queue[2].id);
    expect(s.queue[4].id).toBe(queue[3].id);
    expect(s.queue[5].id).toBe(queue[4].id);
    expect(s.mode).toBe("deck");
    expect(s.scrubIndex).toBeNull();
  });

  it("jump records no decision", () => {
    const queue = makeDeck(3);
    let s = initialDeckState(queue);
    s = deckReducer(s, { t: "jump", to: 2 });
    expect(s.decided).toEqual([]);
  });

  it("undo after a jump falls through to the last real decision, not the jump", () => {
    const queue = makeDeck(3);
    let s = initialDeckState(queue);
    s = deckReducer(s, { t: "decide", card: queue[0], decision: "save", dir: 1 });
    s = deckReducer(s, { t: "flownOut" });
    s = deckReducer(s, { t: "jump", to: 1 }); // reorder — must not clear undoable
    expect(s.undoable?.card.id).toBe(queue[0].id);
    s = deckReducer(s, { t: "undo" });
    expect(s.index).toBe(0);
    expect(s.decided).toEqual([]);
  });

  it("undo after a jump no-ops when there was nothing to undo", () => {
    const queue = makeDeck(3);
    let s = initialDeckState(queue);
    s = deckReducer(s, { t: "jump", to: 2 });
    const before = s;
    s = deckReducer(s, { t: "undo" });
    expect(s).toBe(before);
  });

  it("scrub clamps to the queue bounds and only applies in overview", () => {
    const queue = makeDeck(3);
    let s = initialDeckState(queue);
    s = deckReducer(s, { t: "scrub", to: 5 }); // not in overview yet
    expect(s.scrubIndex).toBeNull();
    s = deckReducer(s, { t: "openOverview" });
    s = deckReducer(s, { t: "scrub", to: 99 });
    expect(s.scrubIndex).toBe(2);
    s = deckReducer(s, { t: "scrub", to: -5 });
    expect(s.scrubIndex).toBe(0);
  });

  it("append grows the queue without touching index", () => {
    const queue = makeDeck(2);
    const more = makeDeck(2);
    let s = initialDeckState(queue);
    s = { ...s, index: 1 };
    s = deckReducer(s, { t: "append", cards: more });
    expect(s.queue.length).toBe(4);
    expect(s.index).toBe(1);
  });

  it("advance steps to the next card without recording a decision", () => {
    const queue = makeDeck(3);
    let s = initialDeckState(queue);
    s = deckReducer(s, { t: "advance" });
    expect(s.index).toBe(1);
    expect(s.decided).toEqual([]); // neutral: not a save or a skip
    expect(s.undoable).toBeNull();
    expect(s.flying).toBeNull();
  });

  it("advance is a no-op while a card is flying out", () => {
    const queue = makeDeck(2);
    let s = initialDeckState(queue);
    s = deckReducer(s, { t: "decide", card: queue[0], decision: "save", dir: 1 });
    const before = s;
    s = deckReducer(s, { t: "advance" });
    expect(s).toBe(before);
  });

  it("advance is a no-op at the end of the queue", () => {
    const queue = makeDeck(1);
    let s = initialDeckState(queue);
    s = { ...s, index: 1 }; // already past the last card
    const before = s;
    s = deckReducer(s, { t: "advance" });
    expect(s).toBe(before);
  });
});
