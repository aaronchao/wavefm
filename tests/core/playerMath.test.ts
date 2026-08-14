import { describe, expect, it } from "vitest";
import {
  FINE_SCRUB_FACTOR,
  formatTime,
  nextSpeed,
  originTransform,
  scrubDeltaSec,
} from "@/src/core/player/playerMath";

describe("nextSpeed", () => {
  it("cycles through the speed list in order", () => {
    expect(nextSpeed(1)).toBe(1.25);
    expect(nextSpeed(1.25)).toBe(1.5);
    expect(nextSpeed(1.5)).toBe(1.75);
    expect(nextSpeed(1.75)).toBe(2);
  });

  it("wraps back to the first speed after the last", () => {
    expect(nextSpeed(2)).toBe(1);
  });

  it("falls back to the first speed for an unknown current value", () => {
    expect(nextSpeed(3)).toBe(1);
  });
});

describe("formatTime", () => {
  it("formats under an hour as m:ss", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(599)).toBe("9:59");
  });

  it("formats an hour or more as h:mm:ss", () => {
    expect(formatTime(3600)).toBe("1:00:00");
    expect(formatTime(3661)).toBe("1:01:01");
  });

  it("clamps negative input to 0", () => {
    expect(formatTime(-5)).toBe("0:00");
  });

  it("floors fractional seconds", () => {
    expect(formatTime(59.9)).toBe("0:59");
  });
});

describe("scrubDeltaSec", () => {
  it("sweeps the full duration across the full width in normal mode", () => {
    expect(scrubDeltaSec(300, 300, 1800, false)).toBe(1800);
  });

  it("sweeps a small fraction of the duration in fine mode for the same drag", () => {
    const normal = scrubDeltaSec(300, 300, 1800, false);
    const fine = scrubDeltaSec(300, 300, 1800, true);
    expect(fine).toBeCloseTo(normal * FINE_SCRUB_FACTOR);
  });

  it("is proportional to drag distance", () => {
    expect(scrubDeltaSec(150, 300, 1800, false)).toBe(900);
  });

  it("supports negative drag (scrubbing backward)", () => {
    expect(scrubDeltaSec(-150, 300, 1800, false)).toBe(-900);
  });

  it("returns 0 for a zero-width container", () => {
    expect(scrubDeltaSec(100, 0, 1800, false)).toBe(0);
  });

  it("returns 0 for an unknown (NaN) duration", () => {
    expect(scrubDeltaSec(100, 300, NaN, false)).toBe(0);
  });
});

describe("originTransform", () => {
  it("is identity when the origin already fills the viewport", () => {
    expect(originTransform({ x: 0, y: 0, width: 1000, height: 800 }, 1000, 800)).toEqual({
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
    });
  });

  it("computes a shrink-and-offset transform for a small top-left origin", () => {
    const t = originTransform({ x: 0, y: 0, width: 100, height: 100 }, 1000, 1000);
    expect(t.scaleX).toBeCloseTo(0.1);
    expect(t.scaleY).toBeCloseTo(0.1);
    expect(t.x).toBeCloseTo(-450);
    expect(t.y).toBeCloseTo(-450);
  });

  it("centers a same-size-but-offset origin with no scale change", () => {
    const t = originTransform({ x: 200, y: 100, width: 1000, height: 800 }, 1000, 800);
    expect(t.scaleX).toBe(1);
    expect(t.scaleY).toBe(1);
    expect(t.x).toBeCloseTo(200);
    expect(t.y).toBeCloseTo(100);
  });

  it("falls back to identity for a degenerate (zero) viewport", () => {
    expect(originTransform({ x: 10, y: 10, width: 50, height: 50 }, 0, 0)).toEqual({
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
    });
  });
});
