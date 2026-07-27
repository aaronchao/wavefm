import { describe, expect, it } from "vitest";
import {
  seedFromId,
  wavrClipStart,
  WAVR_CLIP_SEC,
  WAVR_INTRO_SKIP_SEC,
} from "@/src/core/wavr/clip";

describe("seedFromId", () => {
  it("is deterministic for the same id", () => {
    expect(seedFromId("show1:ep1")).toBe(seedFromId("show1:ep1"));
  });

  it("stays within 0..1", () => {
    for (const id of ["a", "show42:ep7", "", "🎧podcast"]) {
      const s = seedFromId(id);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it("differs across ids (no pathological collisions on simple inputs)", () => {
    const seeds = new Set(["ep1", "ep2", "ep3", "ep4"].map(seedFromId));
    expect(seeds.size).toBe(4);
  });
});

describe("wavrClipStart", () => {
  it("skips the intro on an unknown duration", () => {
    expect(wavrClipStart(null, 0.5)).toBe(WAVR_INTRO_SKIP_SEC);
    expect(wavrClipStart(undefined, 0.5)).toBe(WAVR_INTRO_SKIP_SEC);
    expect(wavrClipStart(NaN, 0.5)).toBe(WAVR_INTRO_SKIP_SEC);
  });

  it("never starts before the intro skip", () => {
    for (const seed of [0, 0.25, 0.5, 0.75, 1]) {
      expect(wavrClipStart(3600, seed)).toBeGreaterThanOrEqual(WAVR_INTRO_SKIP_SEC);
    }
  });

  it("leaves room for the full clip before the episode ends", () => {
    const duration = 3600;
    const start = wavrClipStart(duration, 1); // the latest possible start
    expect(start + WAVR_CLIP_SEC).toBeLessThanOrEqual(duration);
  });

  it("is a pure function of duration and seed", () => {
    expect(wavrClipStart(1800, 0.42)).toBe(wavrClipStart(1800, 0.42));
  });

  it("degrades gracefully for an episode too short for a full 5-minute clip", () => {
    const start = wavrClipStart(120, 0.9);
    expect(Number.isFinite(start)).toBe(true);
    expect(start).toBeGreaterThanOrEqual(0);
  });

  it("varies the start point across the seed range", () => {
    const low = wavrClipStart(3600, 0);
    const high = wavrClipStart(3600, 1);
    expect(high).toBeGreaterThan(low);
  });
});
