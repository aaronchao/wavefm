export type Rgb = { r: number; g: number; b: number };

/**
 * Averages every RGBA pixel in a canvas ImageData buffer down to one color —
 * cheap and good enough at a small (e.g. 16x16) sample size, no need for a
 * real k-means/palette library for a card tint.
 */
export function averageRgb(pixels: ArrayLike<number>): Rgb {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let i = 0; i + 2 < pixels.length; i += 4) {
    r += pixels[i];
    g += pixels[i + 1];
    b += pixels[i + 2];
    count++;
  }
  if (count === 0) return { r: 128, g: 128, b: 128 };
  return { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) };
}

function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return {
    r: Math.round(hue2rgb(h + 1 / 3) * 255),
    g: Math.round(hue2rgb(h) * 255),
    b: Math.round(hue2rgb(h - 1 / 3) * 255),
  };
}

function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Pulls a raw extracted color toward the same desaturated, mid-dark register
 * as the app's own hand-picked BOARD_COLORS, so cover-art colors extracted
 * at full brightness/saturation still sit inside WaveFM's dark theme instead
 * of fighting it.
 */
export function muteColor(rgb: Rgb, opts: { maxSaturation?: number; lightness?: number } = {}): string {
  const maxSaturation = opts.maxSaturation ?? 0.45;
  const lightness = opts.lightness ?? 0.34;
  const { h, s } = rgbToHsl(rgb);
  return toHex(hslToRgb(h, Math.min(s, maxSaturation), lightness));
}
