/**
 * Pure maths for the Show page's dot-matrix globe (no DOM, no canvas).
 *
 * The globe is drawn as points on a sphere under an ORTHOGRAPHIC
 * projection — the "seen from far away" look, and the reason the silhouette
 * stays a perfect circle no matter how the camera turns. Perspective would
 * bow the limb and fight the flat, graphic Nothing aesthetic.
 */

export type LatLon = { lat: number; lon: number };

/** A projected dot: screen position, plus depth for facing/shading. */
export type ProjectedDot = {
  x: number;
  y: number;
  /** Component toward the viewer, -1..1. <= 0 is the far side. */
  facing: number;
};

const DEG = Math.PI / 180;

/**
 * Evenly-spaced points on a sphere via the Fibonacci lattice. A naive
 * lat/lon grid bunches dots tightly at the poles and leaves the equator
 * sparse — the lattice keeps spacing near-uniform, which is what makes it
 * read as a *matrix* rather than a mesh.
 */
export function fibonacciSphere(count: number): LatLon[] {
  const pts: LatLon[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    // y from +1 down to -1, so `i` sweeps pole to pole.
    const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2;
    const theta = golden * i;
    pts.push({
      lat: Math.asin(y) / DEG,
      lon: (((theta / DEG) % 360) + 540) % 360 - 180,
    });
  }
  return pts;
}

/**
 * Evenly-spaced points inside a spherical CAP of angular radius
 * `capDeg` centred on (`centerLat`, `centerLon`).
 *
 * Needed because a globally-uniform lattice collapses under zoom: once the
 * camera is close, the visible cap is a percent or two of the sphere, so
 * almost every point of a whole-sphere lattice is behind the planet or off
 * screen and the handful left over reads as scattered stars rather than a
 * surface. Holding screen density constant that way would need hundreds of
 * thousands of points; sampling only what's visible needs the same few
 * thousand at any zoom.
 *
 * Built at the north pole (where a Fibonacci band is trivial to restrict)
 * and then rotated onto the camera centre, so spacing stays even instead of
 * bunching the way a naive lat/lon box would near the poles.
 */
export function capLattice(
  centerLat: number,
  centerLon: number,
  capDeg: number,
  count: number,
): LatLon[] {
  const cosCap = Math.cos(Math.min(180, Math.max(0, capDeg)) * DEG);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const phi0 = (90 - centerLat) * DEG; // tilt the pole down to the centre
  const lam0 = centerLon * DEG;
  const cosP = Math.cos(phi0);
  const sinP = Math.sin(phi0);
  const cosL = Math.cos(lam0);
  const sinL = Math.sin(lam0);

  const out: LatLon[] = [];
  for (let i = 0; i < count; i++) {
    // z spans only the cap, not the full [-1, 1] of a whole sphere.
    const z = cosCap + ((1 - cosCap) * (i + 0.5)) / count;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    const theta = golden * i;
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);

    // Rotate about Y by (90 - lat), then about Z by lon.
    const x1 = x * cosP + z * sinP;
    const z1 = -x * sinP + z * cosP;
    const x2 = x1 * cosL - y * sinL;
    const y2 = x1 * sinL + y * cosL;

    out.push({
      lat: Math.asin(Math.min(1, Math.max(-1, z1))) / DEG,
      lon: Math.atan2(y2, x2) / DEG,
    });
  }
  return out;
}

/**
 * Angular radius of the region actually on screen, in degrees. Beyond
 * ~90deg the whole visible hemisphere fits and there is nothing to narrow.
 */
export function visibleCapDeg(radius: number, halfDiagonalPx: number): number {
  if (radius <= 0) return 90;
  const ratio = halfDiagonalPx / radius;
  if (ratio >= 1) return 90;
  return Math.min(90, (Math.asin(ratio) / DEG) * 1.15); // margin for drift
}

/**
 * Project a lat/lon onto the screen for a camera centred at
 * (`centerLat`, `centerLon`), with the sphere drawn at `radius` px about
 * (`cx`, `cy`). `facing` <= 0 means the point is round the back and should
 * not be drawn.
 */
export function project(
  point: LatLon,
  centerLat: number,
  centerLon: number,
  radius: number,
  cx: number,
  cy: number,
): ProjectedDot {
  const phi = point.lat * DEG;
  const lambda = (point.lon - centerLon) * DEG;
  const phi0 = centerLat * DEG;

  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const cosLambda = Math.cos(lambda);
  const sinLambda = Math.sin(lambda);
  const cosPhi0 = Math.cos(phi0);
  const sinPhi0 = Math.sin(phi0);

  // Standard orthographic projection about an arbitrary centre.
  const x = cosPhi * sinLambda;
  const y = cosPhi0 * sinPhi - sinPhi0 * cosPhi * cosLambda;
  const facing = sinPhi0 * sinPhi + cosPhi0 * cosPhi * cosLambda;

  return { x: cx + x * radius, y: cy - y * radius, facing };
}

/** Cubic ease-in-out — slow to leave, sustained, gentle to settle. */
export function easeInOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

/**
 * Shortest signed angular distance from `a` to `b` in degrees, in -180..180.
 * Without this the camera takes the long way round whenever a fly-to
 * crosses the antimeridian (e.g. -170 to +170 spins 340deg, not 20).
 */
export function shortestDelta(a: number, b: number): number {
  return ((((b - a) % 360) + 540) % 360) - 180;
}

export type Camera = { lat: number; lon: number; radius: number };

/**
 * The camera part-way through a fly-to, at eased progress `t` (0..1).
 * Longitude takes the short way round; radius is interpolated
 * GEOMETRICALLY, because zoom is multiplicative — a linear ramp from a
 * small radius to a large one appears to hesitate then lurch, while a
 * constant growth *rate* is what reads as a steady cinematic push.
 */
export function cameraAt(from: Camera, to: Camera, t: number): Camera {
  const e = easeInOutCubic(t);
  return {
    lat: from.lat + (to.lat - from.lat) * e,
    lon: from.lon + shortestDelta(from.lon, to.lon) * e,
    radius: from.radius * Math.pow(to.radius / from.radius, e),
  };
}

/**
 * Dot count for a given zoom. Zooming a fixed set of points just spreads
 * them into sparse specks and the matrix falls apart, so density rises with
 * radius to hold roughly constant spacing on screen — the "detail resolving
 * as you approach" read. Clamped at both ends: enough to look like a globe
 * at rest, capped so a deep zoom can't blow up the per-frame cost.
 */
export function dotCountFor(radius: number, base = 1500, max = 9000): number {
  const scale = Math.max(1, radius / 240);
  return Math.min(max, Math.round(base * scale));
}
