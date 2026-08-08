import { describe, expect, it } from "vitest";
import { whyThis } from "@/src/core/library/whyThis";
import { TIME_BUCKETS, type NowEpisode } from "@/src/core/library/rightNow";

const bucket = (id: string) => TIME_BUCKETS.find((b) => b.id === id)!;
function ep(over: Partial<NowEpisode> = {}): NowEpisode {
  return { episodeId: "e", title: "An episode", status: "queued", positionSec: 0, ...over };
}

describe("whyThis", () => {
  it("leads with resuming — the strongest evidence of intent", () => {
    const started = ep({ status: "in_progress", durationSec: 3600, positionSec: 2400 });
    expect(whyThis(started, { bucket: bucket("any") })).toBe("You're partway in — 20 min left");
  });

  it("resuming beats a saved-show match", () => {
    const started = ep({
      status: "in_progress",
      durationSec: 600,
      positionSec: 120,
      showTitle: "Huberman Lab",
    });
    const why = whyThis(started, {
      bucket: bucket("any"),
      savedShowTitles: new Set(["Huberman Lab"]),
    });
    expect(why).toContain("partway in");
  });

  it("mentions the fit only when it actually fills the slot", () => {
    const good = ep({ durationSec: 28 * 60 });
    expect(whyThis(good, { bucket: bucket("short") })).toBe("28 min — fits the time you've got");
  });

  it("does not claim a fit for an episode far shorter than the slot", () => {
    const tiny = ep({ durationSec: 5 * 60 });
    expect(whyThis(tiny, { bucket: bucket("hour") })).not.toContain("fits the time");
  });

  it("names the show when it is one the user saved", () => {
    const e = ep({ durationSec: 5 * 60, showTitle: "Darknet Diaries" });
    const why = whyThis(e, {
      bucket: bucket("any"),
      savedShowTitles: new Set(["Darknet Diaries"]),
    });
    expect(why).toBe("From Darknet Diaries, one of your saved shows");
  });

  it("cites a vibe only once there is a real pattern", () => {
    const e = ep({ title: "a true crime story", durationSec: 90 * 60 });
    expect(whyThis(e, { bucket: bucket("any"), vibeCount: 2 })).not.toContain("you've saved");
    expect(whyThis(e, { bucket: bucket("any"), vibeCount: 6 })).toContain("you've saved 6 like this");
  });

  it("falls back to low commitment for a short episode", () => {
    expect(whyThis(ep({ durationSec: 9 * 60 }), { bucket: bucket("any") })).toBe(
      "Only 9 min — easy one to start",
    );
  });

  it("always returns exactly one reason, never a list", () => {
    const e = ep({ durationSec: 28 * 60, showTitle: "Saved Show" });
    const why = whyThis(e, {
      bucket: bucket("short"),
      savedShowTitles: new Set(["Saved Show"]),
      vibeCount: 10,
    });
    expect(why.split("—")).toHaveLength(2); // one clause, one qualifier
    expect(why).not.toContain("·");
  });

  it("still says something useful with no duration and no context", () => {
    expect(whyThis(ep(), { bucket: bucket("any") })).toBe("Saved for later — still waiting on you");
  });
});
