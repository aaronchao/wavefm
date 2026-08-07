import { describe, expect, it } from "vitest";
import {
  fitsTime,
  rankForNow,
  remainingSec,
  TIME_BUCKETS,
  vibesPresent,
  type NowEpisode,
} from "@/src/core/library/rightNow";

const bucket = (id: string) => TIME_BUCKETS.find((b) => b.id === id)!;

function ep(over: Partial<NowEpisode> & { episodeId: string }): NowEpisode {
  return {
    title: "An episode",
    status: "queued",
    positionSec: 0,
    ...over,
  };
}

describe("remainingSec", () => {
  it("counts down from the resume point, not the total", () => {
    expect(remainingSec(ep({ episodeId: "a", durationSec: 3600, positionSec: 3000 }))).toBe(600);
  });

  it("is undefined when the duration is unknown", () => {
    expect(remainingSec(ep({ episodeId: "a" }))).toBeUndefined();
  });

  it("never goes negative when the position overruns the duration", () => {
    expect(remainingSec(ep({ episodeId: "a", durationSec: 100, positionSec: 150 }))).toBe(0);
  });
});

describe("fitsTime", () => {
  it("accepts anything for the unlimited bucket", () => {
    expect(fitsTime(ep({ episodeId: "a", durationSec: 10 * 3600 }), bucket("any"))).toBe(true);
  });

  it("is cumulative — a short episode fits a longer slot", () => {
    expect(fitsTime(ep({ episodeId: "a", durationSec: 8 * 60 }), bucket("hour"))).toBe(true);
  });

  it("allows headroom past the round number", () => {
    // 32 min is still a "30 min" listen, not hidden by a 2-minute technicality
    expect(fitsTime(ep({ episodeId: "a", durationSec: 32 * 60 }), bucket("short"))).toBe(true);
  });

  it("excludes an episode past the slot's headroom", () => {
    expect(fitsTime(ep({ episodeId: "a", durationSec: 50 * 60 }), bucket("short"))).toBe(false);
  });

  it("judges on time remaining, so a part-heard long episode fits a short slot", () => {
    const half = ep({ episodeId: "a", durationSec: 90 * 60, positionSec: 80 * 60 });
    expect(fitsTime(half, bucket("quick"))).toBe(true);
  });

  it("keeps unknown-duration episodes rather than hiding them", () => {
    expect(fitsTime(ep({ episodeId: "a" }), bucket("quick"))).toBe(true);
  });
});

describe("rankForNow", () => {
  it("drops finished episodes", () => {
    const out = rankForNow(
      [ep({ episodeId: "done", status: "finished", durationSec: 600 })],
      { bucket: bucket("any") },
    );
    expect(out).toHaveLength(0);
  });

  it("leads with an already-started episode", () => {
    const out = rankForNow(
      [
        ep({ episodeId: "fresh", durationSec: 1800 }),
        ep({ episodeId: "started", status: "in_progress", durationSec: 600, positionSec: 60 }),
      ],
      { bucket: bucket("any") },
    );
    expect(out[0].episodeId).toBe("started");
  });

  it("prefers the longest episode that still fits the slot", () => {
    const out = rankForNow(
      [
        ep({ episodeId: "tiny", durationSec: 5 * 60 }),
        ep({ episodeId: "good", durationSec: 28 * 60 }),
      ],
      { bucket: bucket("short") },
    );
    expect(out[0].episodeId).toBe("good");
  });

  it("excludes episodes that overrun the slot", () => {
    const out = rankForNow(
      [ep({ episodeId: "long", durationSec: 3 * 3600 })],
      { bucket: bucket("quick") },
    );
    expect(out).toHaveLength(0);
  });

  it("narrows to a single vibe when one is given", () => {
    const comedy = ep({ episodeId: "c", title: "A comedy special", durationSec: 600 });
    const crime = ep({ episodeId: "k", title: "A true crime story", durationSec: 600 });
    const out = rankForNow([comedy, crime], { bucket: bucket("any"), vibeId: "laughs" });
    expect(out.map((e) => e.episodeId)).toEqual(["c"]);
  });

  it("is stable for equal candidates", () => {
    const a = ep({ episodeId: "a", durationSec: 600 });
    const b = ep({ episodeId: "b", durationSec: 600 });
    expect(rankForNow([b, a], { bucket: bucket("any") }).map((e) => e.episodeId)).toEqual(["a", "b"]);
  });
});

describe("vibesPresent", () => {
  it("counts vibes and ignores finished episodes", () => {
    const out = vibesPresent([
      ep({ episodeId: "1", title: "comedy hour" }),
      ep({ episodeId: "2", title: "comedy night" }),
      ep({ episodeId: "3", title: "true crime", status: "finished" }),
    ]);
    expect(out[0].vibe.id).toBe("laughs");
    expect(out[0].count).toBe(2);
    expect(out.some((v) => v.vibe.id === "edge")).toBe(false);
  });
});
