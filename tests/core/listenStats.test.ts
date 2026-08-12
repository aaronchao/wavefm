import { describe, expect, it } from "vitest";
import {
  activityByDay,
  computeListenStats,
  currentStreakDays,
  topShow,
  totalListenedSeconds,
  type FinishedEpisode,
} from "@/src/core/library/listenStats";

// Noon UTC — safely mid-day in any real timezone, so subtracting whole days
// never crosses a local-midnight boundary and flips which calendar day a
// fixture lands on.
const NOW = Date.parse("2026-08-08T12:00:00Z");
const DAY = 86_400_000;
const ago = (ms: number) => new Date(NOW - ms).toISOString();

function ep(over: Partial<FinishedEpisode> = {}): FinishedEpisode {
  return { episodeId: "e1", showTitle: "Show A", durationSec: 1800, updatedAt: ago(0), ...over };
}

describe("totalListenedSeconds", () => {
  it("sums known durations and ignores missing ones", () => {
    const out = totalListenedSeconds([
      ep({ durationSec: 1800 }),
      ep({ durationSec: 600 }),
      ep({ durationSec: undefined }),
    ]);
    expect(out).toBe(2400);
  });

  it("is 0 for an empty list", () => {
    expect(totalListenedSeconds([])).toBe(0);
  });
});

describe("topShow", () => {
  it("picks the show with the most finishes", () => {
    const out = topShow([
      ep({ showTitle: "A" }),
      ep({ showTitle: "B" }),
      ep({ showTitle: "A" }),
      ep({ showTitle: "A" }),
    ]);
    expect(out).toEqual({ showTitle: "A", count: 3 });
  });

  it("is null with nothing finished, or nothing titled", () => {
    expect(topShow([])).toBeNull();
    expect(topShow([ep({ showTitle: undefined })])).toBeNull();
  });
});

describe("currentStreakDays", () => {
  it("counts today alone", () => {
    expect(currentStreakDays([ep({ updatedAt: ago(0) })], NOW)).toBe(1);
  });

  it("counts consecutive days backward from today", () => {
    const episodes = [
      ep({ episodeId: "a", updatedAt: ago(0) }),
      ep({ episodeId: "b", updatedAt: ago(DAY) }),
      ep({ episodeId: "c", updatedAt: ago(2 * DAY) }),
    ];
    expect(currentStreakDays(episodes, NOW)).toBe(3);
  });

  it("a gap breaks the streak", () => {
    const episodes = [
      ep({ episodeId: "a", updatedAt: ago(0) }),
      // no finish yesterday
      ep({ episodeId: "b", updatedAt: ago(2 * DAY) }),
    ];
    expect(currentStreakDays(episodes, NOW)).toBe(1);
  });

  it("an empty today doesn't break a streak still active from yesterday", () => {
    const episodes = [
      ep({ episodeId: "a", updatedAt: ago(DAY) }),
      ep({ episodeId: "b", updatedAt: ago(2 * DAY) }),
    ];
    expect(currentStreakDays(episodes, NOW)).toBe(2);
  });

  it("is 0 for an empty list", () => {
    expect(currentStreakDays([], NOW)).toBe(0);
  });
});

describe("activityByDay", () => {
  it("returns one entry per day, oldest first, ending today", () => {
    const out = activityByDay([ep({ updatedAt: ago(0) })], NOW, 7);
    expect(out).toHaveLength(7);
    expect(out[6].count).toBe(1); // today, last entry
    expect(out.slice(0, 6).every((d) => d.count === 0)).toBe(true);
  });

  it("buckets multiple finishes on the same day together", () => {
    const out = activityByDay(
      [ep({ episodeId: "a", updatedAt: ago(0) }), ep({ episodeId: "b", updatedAt: ago(3600_000) })],
      NOW,
      3,
    );
    expect(out[2].count).toBe(2);
  });
});

describe("computeListenStats", () => {
  it("assembles all four figures together", () => {
    const episodes = [
      ep({ episodeId: "a", showTitle: "A", durationSec: 1200, updatedAt: ago(0) }),
      ep({ episodeId: "b", showTitle: "A", durationSec: 1800, updatedAt: ago(DAY) }),
    ];
    const stats = computeListenStats(episodes, NOW);
    expect(stats.totalFinished).toBe(2);
    expect(stats.totalSeconds).toBe(3000);
    expect(stats.streakDays).toBe(2);
    expect(stats.topShow).toEqual({ showTitle: "A", count: 2 });
    expect(stats.activity).toHaveLength(42);
  });
});
