import { describe, expect, it } from "vitest";
import { averageRgb, muteColor } from "@/src/core/color/dominantColor";

describe("averageRgb", () => {
  it("averages a single solid-color pixel buffer", () => {
    const pixels = [200, 100, 50, 255];
    expect(averageRgb(pixels)).toEqual({ r: 200, g: 100, b: 50 });
  });

  it("averages multiple pixels", () => {
    // Two pixels: pure red and pure blue -> average is purple-ish.
    const pixels = [255, 0, 0, 255, 0, 0, 255, 255];
    expect(averageRgb(pixels)).toEqual({ r: 128, g: 0, b: 128 });
  });

  it("falls back to mid-gray for an empty buffer", () => {
    expect(averageRgb([])).toEqual({ r: 128, g: 128, b: 128 });
  });

  it("ignores the alpha channel", () => {
    const opaque = [10, 20, 30, 255];
    const transparent = [10, 20, 30, 0];
    expect(averageRgb(opaque)).toEqual(averageRgb(transparent));
  });
});

describe("muteColor", () => {
  it("returns a well-formed hex color", () => {
    expect(muteColor({ r: 255, g: 0, b: 0 })).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("caps saturation so a vivid input stays muted", () => {
    // Pure saturated red muted down should be noticeably darker/greyer than
    // the source, not still #ff0000.
    expect(muteColor({ r: 255, g: 0, b: 0 })).not.toBe("#ff0000");
  });

  it("is deterministic for the same input", () => {
    const rgb = { r: 90, g: 140, b: 200 };
    expect(muteColor(rgb)).toBe(muteColor(rgb));
  });

  it("keeps true gray as gray (no hue to distort)", () => {
    const hex = muteColor({ r: 128, g: 128, b: 128 });
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it("respects a custom lightness target", () => {
    const dark = muteColor({ r: 200, g: 50, b: 50 }, { lightness: 0.15 });
    const light = muteColor({ r: 200, g: 50, b: 50 }, { lightness: 0.7 });
    const toL = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
    expect(toL(light)).toBeGreaterThan(toL(dark));
  });
});
