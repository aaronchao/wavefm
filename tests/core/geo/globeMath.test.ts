import { describe, expect, it } from "vitest";
import {
  cameraAt,
  capLattice,
  visibleCapDeg,
  dotCountFor,
  easeInOutCubic,
  fibonacciSphere,
  project,
  shortestDelta,
} from "@/src/core/geo/globeMath";
import { cityFor, PRIMARY_CITIES } from "@/src/core/geo/cities";
import { COUNTRIES } from "@/src/core/geo/countries";

describe("fibonacciSphere", () => {
  it("returns the requested number of points, all in range", () => {
    const pts = fibonacciSphere(500);
    expect(pts).toHaveLength(500);
    for (const p of pts) {
      expect(p.lat).toBeGreaterThanOrEqual(-90.001);
      expect(p.lat).toBeLessThanOrEqual(90.001);
      expect(p.lon).toBeGreaterThanOrEqual(-180);
      expect(p.lon).toBeLessThanOrEqual(180);
    }
  });

  it("spreads points instead of bunching at the poles", () => {
    // A naive lat/lon grid would put most points in the top/bottom bands.
    const pts = fibonacciSphere(1000);
    const nearPoles = pts.filter((p) => Math.abs(p.lat) > 70).length;
    // Caps above 70deg are ~6% of a sphere's area; allow slack, not 50%.
    expect(nearPoles / pts.length).toBeLessThan(0.15);
  });
});

describe("project", () => {
  it("puts the camera centre at the middle of the screen", () => {
    const d = project({ lat: 20, lon: 30 }, 20, 30, 100, 500, 400);
    expect(d.x).toBeCloseTo(500, 6);
    expect(d.y).toBeCloseTo(400, 6);
    expect(d.facing).toBeCloseTo(1, 6);
  });

  it("marks the antipode as facing away", () => {
    const d = project({ lat: -20, lon: -150 }, 20, 30, 100, 0, 0);
    expect(d.facing).toBeLessThan(0);
  });

  it("keeps every visible point inside the sphere's silhouette", () => {
    const r = 150;
    for (const p of fibonacciSphere(400)) {
      const d = project(p, 12, 45, r, 0, 0);
      if (d.facing > 0) expect(Math.hypot(d.x, d.y)).toBeLessThanOrEqual(r + 1e-6);
    }
  });
});

describe("shortestDelta", () => {
  it("crosses the antimeridian the short way", () => {
    expect(shortestDelta(-170, 170)).toBeCloseTo(-20, 6);
    expect(shortestDelta(170, -170)).toBeCloseTo(20, 6);
  });

  it("is zero for the same angle", () => {
    expect(shortestDelta(45, 45)).toBeCloseTo(0, 6);
  });
});

describe("easeInOutCubic", () => {
  it("is pinned at both ends and symmetric in the middle", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 6);
  });

  it("clamps out-of-range input", () => {
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(2)).toBe(1);
  });
});

describe("cameraAt", () => {
  const from = { lat: 0, lon: 0, radius: 100 };
  const to = { lat: 30, lon: 120, radius: 800 };

  it("hits the endpoints exactly", () => {
    expect(cameraAt(from, to, 0)).toEqual(from);
    const end = cameraAt(from, to, 1);
    expect(end.lat).toBeCloseTo(30, 6);
    expect(end.lon).toBeCloseTo(120, 6);
    expect(end.radius).toBeCloseTo(800, 6);
  });

  it("grows the radius geometrically, not linearly", () => {
    // Linear would be the arithmetic mean (450); geometric is sqrt(100*800).
    expect(cameraAt(from, to, 0.5).radius).toBeCloseTo(Math.sqrt(100 * 800), 4);
  });

  it("takes the short way round the antimeridian", () => {
    const mid = cameraAt({ lat: 0, lon: -170, radius: 100 }, { lat: 0, lon: 170, radius: 100 }, 0.5);
    // Halfway between -170 and 170 the short way IS the antimeridian, which
    // -180 and +180 both name; project() takes it through sin/cos, so the
    // sign is immaterial. What matters is that it didn't travel via 0.
    expect(Math.abs(mid.lon)).toBeCloseTo(180, 6);
  });

  it("advances monotonically", () => {
    let prev = -Infinity;
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const r = cameraAt(from, to, t).radius;
      expect(r).toBeGreaterThan(prev);
      prev = r;
    }
  });
});

describe("dotCountFor", () => {
  it("adds density as the camera closes in", () => {
    expect(dotCountFor(1200)).toBeGreaterThan(dotCountFor(240));
  });

  it("clamps at both ends so a deep zoom can't blow up the frame cost", () => {
    expect(dotCountFor(10)).toBe(1500);
    expect(dotCountFor(100000)).toBe(9000);
  });
});

describe("cityFor", () => {
  it("defaults to the country's podcast-scene city, not its centroid", () => {
    const city = cityFor(COUNTRIES.CN, "a show about tech");
    expect(city).toEqual(PRIMARY_CITIES.CN);
    // The centroid is rural Gansu — the whole reason this layer exists.
    expect(city!.lat).not.toBeCloseTo(COUNTRIES.CN.lat, 1);
  });

  it("prefers a city actually named in the show's text", () => {
    expect(cityFor(COUNTRIES.CN, "北京老炮儿聊天")!.name).toBe("Beijing");
    expect(cityFor(COUNTRIES.JP, "Kyoto walking tour")!.name).toBe("Kyoto");
  });

  it("ignores a city outside the inferred country", () => {
    // Mentioning Tokyo doesn't mean a Chinese show broadcasts from there.
    expect(cityFor(COUNTRIES.CN, "we visited Tokyo last week")).toEqual(PRIMARY_CITIES.CN);
  });

  it("returns null without a country", () => {
    expect(cityFor(null, "Bangkok")).toBeNull();
  });
});

describe("capLattice", () => {
  const angDist = (a: {lat:number;lon:number}, b: {lat:number;lon:number}) => {
    const D = Math.PI / 180;
    const c =
      Math.sin(a.lat * D) * Math.sin(b.lat * D) +
      Math.cos(a.lat * D) * Math.cos(b.lat * D) * Math.cos((a.lon - b.lon) * D);
    return (Math.acos(Math.min(1, Math.max(-1, c))) / Math.PI) * 180;
  };

  it("keeps every point inside the requested cap", () => {
    const centre = { lat: 39.9, lon: 116.41 };
    for (const p of capLattice(centre.lat, centre.lon, 12, 500)) {
      expect(angDist(centre, p)).toBeLessThanOrEqual(12.001);
    }
  });

  it("centres on the requested point", () => {
    const centre = { lat: -33.87, lon: 151.21 };
    const pts = capLattice(centre.lat, centre.lon, 10, 400);
    const mean = pts.reduce((acc, p) => acc + angDist(centre, p), 0) / pts.length;
    // Uniform over a small cap -> mean distance ~ 2/3 of the radius.
    expect(mean).toBeLessThan(8);
  });

  it("works across the antimeridian without wrapping artefacts", () => {
    const centre = { lat: 0, lon: 179.5 };
    for (const p of capLattice(centre.lat, centre.lon, 8, 300)) {
      expect(angDist(centre, p)).toBeLessThanOrEqual(8.001);
    }
  });

  it("works at a pole", () => {
    const centre = { lat: 90, lon: 0 };
    for (const p of capLattice(centre.lat, centre.lon, 15, 300)) {
      expect(angDist(centre, p)).toBeLessThanOrEqual(15.001);
    }
  });

  it("returns the requested count", () => {
    expect(capLattice(10, 20, 30, 250)).toHaveLength(250);
  });
});

describe("visibleCapDeg", () => {
  it("is the full hemisphere when the globe fits on screen", () => {
    expect(visibleCapDeg(200, 500)).toBe(90);
  });

  it("narrows as the camera closes in", () => {
    const far = visibleCapDeg(400, 500);
    const near = visibleCapDeg(4000, 500);
    expect(near).toBeLessThan(far);
    expect(near).toBeLessThan(20);
  });

  it("never returns a degenerate value", () => {
    expect(visibleCapDeg(0, 500)).toBe(90);
  });
});
