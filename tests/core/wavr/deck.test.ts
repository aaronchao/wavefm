import { beforeEach, describe, expect, it } from "vitest";
import { buildDeck } from "@/src/core/wavr";
import { candidate, discussion, resetIds, tags } from "./fixtures";

const PROFILE = tags({ psychology: 1, therapy: 1, crime: 1 });

const psych = (over = {}) =>
  candidate({
    discussions: [discussion({ tags: tags({ psychology: 1 }) })],
    ...over,
  });

beforeEach(resetIds);

describe("buildDeck", () => {
  it("is deterministic — the same input builds a byte-identical deck", () => {
    resetIds();
    const a = buildDeck(
      [psych(), psych(), psych({ showId: "shared" }), psych({ showId: "shared" })],
      PROFILE,
    );
    resetIds();
    const b = buildDeck(
      [psych(), psych(), psych({ showId: "shared" }), psych({ showId: "shared" })],
      PROFILE,
    );
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("drops candidates with no honest reason to be shown", () => {
    const deck = buildDeck(
      [psych(), candidate({ discussions: [discussion({ tags: tags({ golf: 1 }) })] })],
      PROFILE,
    );
    expect(deck).toHaveLength(1);
  });

  it("caps how many cards one show contributes", () => {
    const four = [1, 2, 3, 4].map(() => psych({ showId: "same" }));
    const deck = buildDeck(four, PROFILE, { maxPerShow: 2 });
    expect(deck.filter((c) => c.showId === "same")).toHaveLength(2);
  });

  it("never places two cards from the same show back to back", () => {
    const cs = [
      psych({ showId: "a" }),
      psych({ showId: "a" }),
      psych({ showId: "b" }),
      psych({ showId: "b" }),
      psych({ showId: "c" }),
    ];
    const deck = buildDeck(cs, PROFILE);
    for (let i = 1; i < deck.length; i++) {
      expect(deck[i].showId).not.toBe(deck[i - 1].showId);
    }
  });

  it("keeps unplayable cards out of the opening slots", () => {
    const cs = [
      ...Array.from({ length: 3 }, (_, i) =>
        psych({ showId: `mute${i}`, audioUrl: undefined }),
      ),
      ...Array.from({ length: 6 }, (_, i) => psych({ showId: `loud${i}` })),
    ];
    const deck = buildDeck(cs, PROFILE, { audioFirstSlots: 6 });
    for (const card of deck.slice(0, 6)) expect(card.audioUrl).toBeTruthy();
    // they are demoted, not discarded
    expect(deck).toHaveLength(9);
  });

  it("demotes an over-represented tag instead of dropping it", () => {
    const cs = [
      ...Array.from({ length: 8 }, (_, i) => psych({ showId: `p${i}` })),
      ...Array.from({ length: 2 }, (_, i) =>
        candidate({
          showId: `c${i}`,
          discussions: [discussion({ tags: tags({ crime: 1 }) })],
        }),
      ),
    ];
    const deck = buildDeck(cs, PROFILE, { dominantTagCap: 0.5 });
    expect(deck).toHaveLength(10); // nothing lost
    const leadingPsych = deck
      .slice(0, 5)
      .filter((c) => c.matchedTags[0] === "psychology").length;
    expect(leadingPsych).toBeLessThanOrEqual(5);
    // the crime cards are pulled into the deck rather than buried under 8 psych
    expect(deck.findIndex((c) => c.matchedTags[0] === "crime")).toBeLessThan(8);
  });

  it("orders by score, best first", () => {
    const strong = candidate({
      showId: "strong",
      discussions: [discussion({ tags: tags({ psychology: 1 }), sentiment: 1 })],
    });
    const weak = candidate({
      showId: "weak",
      discussions: [
        discussion({ tags: tags({ psychology: 1 }), sentiment: 0, intent: "comention" }),
      ],
    });
    const deck = buildDeck([weak, strong], PROFILE);
    expect(deck[0].showId).toBe("strong");
    expect(deck[0].score).toBeGreaterThan(deck[1].score);
  });

  it("builds stable ids and carries the quote through", () => {
    const deck = buildDeck([psych({ showId: "s", episodeId: "e" })], PROFILE);
    expect(deck[0].id).toBe("s:e");
    expect(deck[0].quote?.text).toBe("worth every minute");
    expect(deck[0].why).toContain("psychology");
  });

  it("respects the deck limit", () => {
    const cs = Array.from({ length: 30 }, (_, i) => psych({ showId: `s${i}` }));
    expect(buildDeck(cs, PROFILE, { limit: 12 })).toHaveLength(12);
  });

  it("returns an empty deck for an empty profile rather than throwing", () => {
    expect(buildDeck([psych()], {})).toEqual([]);
  });
});
