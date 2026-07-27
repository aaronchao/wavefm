import { beforeEach, describe, expect, it } from "vitest";
import { buildWhy, matchDiscussion, MIN_MATCH, scoreCandidate } from "@/src/core/wavr";
import { candidate, discussion, resetIds, tags } from "./fixtures";

const PROFILE = tags({ psychology: 1, therapy: 1 });

beforeEach(resetIds);

describe("matchDiscussion", () => {
  it("scores tag overlap", () => {
    const overlapping = matchDiscussion(
      PROFILE,
      discussion({ tags: tags({ psychology: 1 }) }),
    );
    const unrelated = matchDiscussion(
      PROFILE,
      discussion({ tags: tags({ woodworking: 1 }) }),
    );
    expect(overlapping).toBeGreaterThan(0);
    expect(unrelated).toBe(0);
  });

  it("ranks intents: recommendation > seed > comention", () => {
    const t = tags({ psychology: 1 });
    const score = (intent: "recommendation" | "seed" | "comention") =>
      matchDiscussion(PROFILE, discussion({ tags: t, intent }));
    expect(score("recommendation")).toBeGreaterThan(score("seed"));
    expect(score("seed")).toBeGreaterThan(score("comention"));
  });

  it("gates a negative-sentiment thread to zero — popularity is not endorsement", () => {
    const t = tags({ psychology: 1 });
    expect(
      matchDiscussion(PROFILE, discussion({ tags: t, sentiment: -1 })),
    ).toBe(0);
    expect(
      matchDiscussion(PROFILE, discussion({ tags: t, sentiment: 1 })),
    ).toBeGreaterThan(matchDiscussion(PROFILE, discussion({ tags: t, sentiment: 0 })));
  });
});

describe("scoreCandidate", () => {
  it("drops a candidate with no tag overlap", () => {
    const c = candidate({
      discussions: [discussion({ tags: tags({ woodworking: 1 }) })],
    });
    expect(scoreCandidate(PROFILE, c)).toBeNull();
  });

  it("drops a candidate with no discussion at all", () => {
    expect(scoreCandidate(PROFILE, candidate({ discussions: [] }))).toBeNull();
  });

  it("drops a candidate below MIN_MATCH", () => {
    // a sliver of overlap swamped by unrelated tags
    const c = candidate({
      discussions: [
        discussion({
          tags: tags({ psychology: 1, a: 9, b: 9, c: 9, d: 9, e: 9 }),
          intent: "comention",
        }),
      ],
    });
    const raw = matchDiscussion(PROFILE, c.discussions[0]);
    expect(raw).toBeLessThan(MIN_MATCH);
    expect(scoreCandidate(PROFILE, c)).toBeNull();
  });

  it("picks the best-matching discussion and shows ITS quote", () => {
    const c = candidate({
      discussions: [
        discussion({
          tags: tags({ woodworking: 1, psychology: 0.1 }),
          quote: { source: "V2EX", text: "weak match" },
        }),
        discussion({
          tags: tags({ psychology: 1 }),
          quote: { source: "r/podcasts", text: "strong match" },
        }),
      ],
    });
    const m = scoreCandidate(PROFILE, c);
    expect(m?.quote.text).toBe("strong match");
  });

  it("returns overlapping tags, strongest first", () => {
    const c = candidate({
      discussions: [discussion({ tags: tags({ therapy: 3, psychology: 1, zzz: 5 }) })],
    });
    expect(scoreCandidate(PROFILE, c)?.matchedTags).toEqual(["therapy", "psychology"]);
  });

  it("breaks ties on quote text, so input order cannot change the result", () => {
    const t = tags({ psychology: 1 });
    const a = discussion({ tags: t, quote: { source: "r/podcasts", text: "aaa" } });
    const b = discussion({ tags: t, quote: { source: "r/podcasts", text: "bbb" } });
    const forward = scoreCandidate(PROFILE, candidate({ discussions: [a, b] }));
    const reverse = scoreCandidate(PROFILE, candidate({ discussions: [b, a] }));
    expect(forward?.quote.text).toBe("aaa");
    expect(reverse?.quote.text).toBe("aaa");
  });
});

describe("buildWhy", () => {
  it("names the matched tag and the source", () => {
    expect(buildWhy(["psychology"], { source: "r/podcasts", text: "x" })).toBe(
      "Matches your interest in psychology — r/podcasts listeners keep bringing it up",
    );
  });

  it("falls back when the quote has no source", () => {
    expect(buildWhy(["psychology"], { source: "", text: "x" })).toBe(
      "Because you follow psychology",
    );
  });

  it("has honest cold-start copy when nothing matched", () => {
    expect(buildWhy([], { source: "r/podcasts", text: "x" })).toBe(
      "A starting point — tell Wavr what you like to sharpen this",
    );
  });

  it("never invents a count", () => {
    const why = buildWhy(["psychology"], { source: "r/podcasts", text: "x" });
    expect(why).not.toMatch(/\d/);
  });
});
