import { describe, expect, it } from "vitest";
import {
  episodesToRetire,
  GRACE_MS,
  isProbablyFinished,
  msUntilRetire,
  UNKNOWN_DURATION_MS,
  type HandoffEpisode,
} from "@/src/core/library/autoRetire";

const NOW = Date.parse("2026-08-08T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const HOUR = 3600_000;

function ep(over: Partial<HandoffEpisode> = {}): HandoffEpisode {
  return { episodeId: "e1", status: "queued", durationSec: 3600, ...over };
}

describe("isProbablyFinished", () => {
  it("is false for an episode never handed off to a player", () => {
    expect(isProbablyFinished(ep({ openedAt: undefined }), NOW)).toBe(false);
  });

  it("is false while the episode could still be playing", () => {
    expect(isProbablyFinished(ep({ openedAt: ago(30 * 60_000) }), NOW)).toBe(false);
  });

  it("is false during the grace window, since people pause", () => {
    // Full hour elapsed, but only 2h total — inside the 6h grace.
    expect(isProbablyFinished(ep({ openedAt: ago(2 * HOUR) }), NOW)).toBe(false);
  });

  it("is true once duration plus grace has passed", () => {
    expect(isProbablyFinished(ep({ openedAt: ago(HOUR + GRACE_MS + 1000) }), NOW)).toBe(true);
  });

  it("waits a full day when the duration is unknown", () => {
    const noDuration = ep({ durationSec: undefined, openedAt: ago(10 * HOUR) });
    expect(isProbablyFinished(noDuration, NOW)).toBe(false);
    const later = ep({ durationSec: undefined, openedAt: ago(UNKNOWN_DURATION_MS + GRACE_MS + 1000) });
    expect(isProbablyFinished(later, NOW)).toBe(true);
  });

  it("leaves an already-finished episode alone", () => {
    expect(isProbablyFinished(ep({ status: "finished", openedAt: ago(50 * HOUR) }), NOW)).toBe(false);
  });

  it("ignores an unparseable timestamp rather than retiring on it", () => {
    expect(isProbablyFinished(ep({ openedAt: "not a date" }), NOW)).toBe(false);
  });

  it("retires an in-progress episode too — a pause that old means abandoned or done", () => {
    expect(
      isProbablyFinished(ep({ status: "in_progress", openedAt: ago(HOUR + GRACE_MS + 1000) }), NOW),
    ).toBe(true);
  });
});

describe("episodesToRetire", () => {
  it("selects only the ones past their window", () => {
    const out = episodesToRetire(
      [
        ep({ episodeId: "fresh", openedAt: ago(10 * 60_000) }),
        ep({ episodeId: "old", openedAt: ago(HOUR + GRACE_MS + 1000) }),
        ep({ episodeId: "never-opened" }),
      ],
      NOW,
    );
    expect(out.map((e) => e.episodeId)).toEqual(["old"]);
  });

  it("returns nothing for an empty library", () => {
    expect(episodesToRetire([], NOW)).toEqual([]);
  });
});

describe("msUntilRetire", () => {
  it("counts down and never goes negative", () => {
    expect(msUntilRetire(ep({ openedAt: ago(HOUR) }), NOW)).toBe(GRACE_MS);
    expect(msUntilRetire(ep({ openedAt: ago(100 * HOUR) }), NOW)).toBe(0);
  });

  it("is null when nothing will fire", () => {
    expect(msUntilRetire(ep({ openedAt: undefined }), NOW)).toBeNull();
    expect(msUntilRetire(ep({ status: "finished", openedAt: ago(HOUR) }), NOW)).toBeNull();
  });
});
