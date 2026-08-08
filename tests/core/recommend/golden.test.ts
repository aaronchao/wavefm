import { describe, expect, it } from "vitest";
import { recommend, type RecommendInput, type ShowInput } from "@/src/core/recommend";

/**
 * Golden fixtures for the recommendation pipeline (REFINEMENTS §6).
 *
 * The scoring weights are spread across vectorize/taste/score/cluster/
 * diversify, so a tweak in any one of them silently reshapes the ranking
 * everywhere and nothing fails — the unit tests each check one stage in
 * isolation, which is exactly what a weight change slips between.
 *
 * These snapshot the WHOLE pipeline's output for a fixed corpus. They are
 * not correctness assertions: a diff here isn't necessarily a bug, it's a
 * prompt to look. Reviewing it is the point — if the new ordering is
 * intended, update the snapshot deliberately and the diff documents the
 * behaviour change in the commit.
 *
 * `now` is pinned because freshness decays against it; without that these
 * would rot on their own and the failure would say nothing.
 */

const NOW = new Date("2026-06-01T00:00:00.000Z");

function show(
  id: string,
  title: string,
  categories: string[],
  description: string,
  lastEpisodeAt?: string,
): ShowInput {
  return { id, title, categories, description, lastEpisodeAt };
}

/** A deliberately mixed corpus: three clear topics plus a couple of ringers. */
const CANDIDATES: ShowInput[] = [
  show("tc1", "Casefile True Crime", ["True Crime"], "Detailed accounts of criminal cases and investigations", "2026-05-28"),
  show("tc2", "Murder in the Archives", ["True Crime", "History"], "Cold case murder investigations from historical records", "2026-05-20"),
  show("sci1", "Deep Space Weekly", ["Science"], "Astronomy, physics and the search for life beyond earth", "2026-05-30"),
  show("sci2", "The Quantum Hour", ["Science", "Technology"], "Quantum physics and computing explained for everyone", "2026-04-02"),
  show("biz1", "Startup Teardown", ["Business"], "How companies are built, funded and sometimes fail", "2026-05-29"),
  show("biz2", "The Money Desk", ["Business", "News"], "Markets, economics and personal finance each week", "2026-05-15"),
  show("com1", "Two Idiots Talking", ["Comedy"], "Improvised nonsense and long-running in-jokes", "2026-05-31"),
  show("stale", "Abandoned Broadcast", ["Science"], "Astronomy and physics, but the feed stopped years ago", "2021-01-01"),
];

const ENGAGED: ShowInput[] = [
  show("saved-sci", "Cosmos Explained", ["Science"], "Astronomy and physics for curious people"),
  show("saved-tc", "Nightfall Cases", ["True Crime"], "Investigations into unsolved criminal cases"),
];

const BASE: RecommendInput = {
  candidates: CANDIDATES,
  engagedShows: ENGAGED,
  engagements: [
    { showId: "saved-sci", type: "save" },
    { showId: "saved-tc", type: "save" },
  ],
  now: NOW,
};

/** Stable, readable shape — ids and rounded scores, not whole vectors. */
function summarize(clusters: ReturnType<typeof recommend>) {
  return clusters.map((c) => ({
    label: c.label,
    why: c.why,
    items: c.items.map((i) => `${i.show.id}@${i.score.toFixed(3)}`),
  }));
}

describe("recommendation golden fixtures", () => {
  it("ranks a saved-shows taste profile stably", () => {
    expect(summarize(recommend(BASE))).toMatchSnapshot();
  });

  it("ranks stably when interests are supplied instead of history", () => {
    const out = recommend({
      candidates: CANDIDATES,
      engagedShows: [],
      engagements: [],
      interests: ["business", "comedy"],
      now: NOW,
    });
    expect(summarize(out)).toMatchSnapshot();
  });

  it("reflects ratings and fatigue in the ranking", () => {
    const out = recommend({
      ...BASE,
      ratings: { sci2: { source: "douban", rating: 9.4 }, tc1: { source: "douban", rating: 6.1 } },
      impressions: { sci1: 8 },
    });
    expect(summarize(out)).toMatchSnapshot();
  });

  it("is deterministic — same input, identical output", () => {
    expect(summarize(recommend(BASE))).toEqual(summarize(recommend(BASE)));
  });

  it("never surfaces a blocked or already-saved show", () => {
    const out = recommend({
      ...BASE,
      engagements: [...BASE.engagements, { showId: "tc1", type: "block" }],
    });
    const ids = out.flatMap((c) => c.items.map((i) => i.show.id));
    expect(ids).not.toContain("tc1");
    expect(ids).not.toContain("saved-sci");
  });
});
