import { describe, expect, it } from "vitest";
import { discussionScore, rankByDiscussion, type SimilarItemInput } from "@/src/core/recommend";

const item = (over: Partial<SimilarItemInput>): SimilarItemInput => ({
  id: over.id ?? "x",
  title: over.title ?? "Show",
  categories: over.categories ?? [],
  ...over,
});

describe("discussionScore", () => {
  it("scores real chatter and ignores pure popularity", () => {
    expect(discussionScore({ redditPosts: 30, redditComments: 400 })).toBeGreaterThan(0.4);
    expect(discussionScore({ v2exMentions: 20 })).toBeGreaterThan(0.4);
    // subscribers/plays alone are popularity, not discussion -> null
    expect(discussionScore({ subscribers: 500_000, plays: 1_000_000 })).toBeNull();
    expect(discussionScore(undefined)).toBeNull();
  });
});

describe("rankByDiscussion", () => {
  it("requires real discussion — undiscussed candidates are dropped", () => {
    const picks = rankByDiscussion({
      saved: [],
      candidates: [
        item({ id: "quiet", title: "No chatter", buzz: { subscribers: 900_000 } }),
        item({ id: "loud", title: "Talked about", buzz: { redditPosts: 20, redditComments: 300 } }),
      ],
    });
    expect(picks.map((p) => p.item.id)).toEqual(["loud"]);
  });

  it("penalises shows already on a chart (the user has seen those)", () => {
    const picks = rankByDiscussion({
      saved: [],
      candidates: [
        item({ id: "charted", title: "On Apple", chartRank: 3, buzz: { redditPosts: 20, redditComments: 300 } }),
        item({ id: "gem", title: "Off chart", buzz: { redditPosts: 20, redditComments: 300 } }),
      ],
    });
    expect(picks[0].item.id).toBe("gem");
    expect(picks[0].hiddenGem).toBe(true);
    expect(picks[0].why).toMatch(/Under the radar/);
  });

  it("does not flag a mega-show as a hidden gem", () => {
    const [pick] = rankByDiscussion({
      saved: [],
      candidates: [
        item({ id: "big", title: "Huge", buzz: { redditPosts: 40, redditComments: 900, subscribers: 800_000 } }),
      ],
    });
    expect(pick.hiddenGem).toBe(false);
  });

  it("is deterministic and respects the limit", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      item({ id: `s${i}`, title: `Show ${i}`, buzz: { redditPosts: 10 + i } }),
    );
    const a = rankByDiscussion({ saved: [], candidates: many, limit: 4 });
    const b = rankByDiscussion({ saved: [], candidates: [...many].reverse(), limit: 4 });
    expect(a.map((p) => p.item.id)).toEqual(b.map((p) => p.item.id));
    expect(a).toHaveLength(4);
  });
});
