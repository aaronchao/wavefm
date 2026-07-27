import { describe, expect, it } from "vitest";
import {
  CLIP_SECONDS,
  clipStart,
  clipTarget,
  middleFraction,
  parseItunesDuration,
  pickIndex,
} from "@/src/core/preview";

describe("clipStart", () => {
  it("always fits the clip inside the episode with edge padding", () => {
    for (const rand of [0, 0.25, 0.5, 0.99, 1]) {
      const start = clipStart(1800, rand);
      expect(start).toBeGreaterThanOrEqual(15);
      expect(start + CLIP_SECONDS).toBeLessThanOrEqual(1800 - 15);
    }
  });

  it("is deterministic for a given random input", () => {
    expect(clipStart(3600, 0.5)).toBe(clipStart(3600, 0.5));
  });

  it("starts at 0 when duration is unknown or too short", () => {
    expect(clipStart(null, 0.7)).toBe(0);
    expect(clipStart(undefined, 0.7)).toBe(0);
    expect(clipStart(45, 0.7)).toBe(0); // shorter than clip + padding
    expect(clipStart(Number.NaN, 0.7)).toBe(0);
  });

  it("clamps out-of-range random inputs", () => {
    expect(clipStart(1800, -1)).toBe(15);
    expect(clipStart(1800, 2)).toBe(15 + (1800 - CLIP_SECONDS - 30));
  });
});

describe("clipTarget", () => {
  it("leaves startAt alone when the duration is unknown", () => {
    // the bug this guards: NaN duration collapsing the target to 0
    expect(clipTarget(Number.NaN, 900)).toBe(900);
    expect(clipTarget(null, 900)).toBe(900);
    expect(clipTarget(undefined, 900)).toBe(900);
    expect(clipTarget(0, 900)).toBe(900);
  });

  it("resolves a fraction against the real duration, beating the seconds fallback", () => {
    expect(clipTarget(1000, 12, 0.5)).toBe(500);
  });

  it("keeps a whole clip inside the episode", () => {
    expect(clipTarget(100, 95)).toBe(100 - CLIP_SECONDS);
    expect(clipTarget(1000, 0, 0.99)).toBe(1000 - CLIP_SECONDS);
  });

  it("never returns a negative target for a very short episode", () => {
    expect(clipTarget(10, 5)).toBe(0);
  });

  it("uses startAt when no fraction is given", () => {
    expect(clipTarget(1000, 120)).toBe(120);
  });
});

describe("middleFraction", () => {
  it("stays inside the central fifth for every random value", () => {
    for (const rand of [0, 0.5, 0.999, 1, -0.2, 3]) {
      const f = middleFraction(rand);
      expect(f).toBeGreaterThanOrEqual(0.4);
      expect(f).toBeLessThanOrEqual(0.6 + 1e-9);
    }
  });

  it("is deterministic and centered", () => {
    expect(middleFraction(0.5)).toBeCloseTo(0.5);
    expect(middleFraction(0.5)).toBe(middleFraction(0.5));
  });
});

describe("pickIndex", () => {
  it("stays in bounds for every random value", () => {
    for (const rand of [0, 0.5, 0.999, 1, -0.2, 3]) {
      const i = pickIndex(10, rand);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(10);
    }
  });

  it("returns 0 for empty lists", () => {
    expect(pickIndex(0, 0.5)).toBe(0);
  });
});

describe("parseItunesDuration", () => {
  it("parses the three RSS formats", () => {
    expect(parseItunesDuration("1830")).toBe(1830);
    expect(parseItunesDuration("30:30")).toBe(1830);
    expect(parseItunesDuration("1:02:03")).toBe(3723);
    expect(parseItunesDuration(2712)).toBe(2712);
  });

  it("rejects garbage without throwing", () => {
    expect(parseItunesDuration("")).toBeUndefined();
    expect(parseItunesDuration("soon")).toBeUndefined();
    expect(parseItunesDuration("1:2:3:4")).toBeUndefined();
    expect(parseItunesDuration(null)).toBeUndefined();
    expect(parseItunesDuration(-5)).toBeUndefined();
  });
});
