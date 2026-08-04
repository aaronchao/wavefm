"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import type { GlobeMethods } from "react-globe.gl";
import type { Country } from "@/src/core/geo/countries";
import { WORLD_CITIES } from "./worldCities";

// WebGL only exists client-side — Globe touches `window` at import time, so
// it has to be dynamically imported with ssr disabled rather than a plain
// top-level import (which would crash the Show page's server render).
const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

type CityPoint = { lat: number; lng: number; city: string; size?: number; color?: string };

/**
 * The Show page's animated background (§11 override, explicitly approved
 * alongside the earlier sharing feature) — a slowly auto-rotating globe
 * of real city dots, standing in for the "dots forming the earth" look.
 * When `target` (the show's best-effort inferred country — see
 * src/core/geo/inferCountry) resolves, the camera flies there and a
 * pulsing ring marks the spot: the extra "here's roughly where this was
 * made" context the user asked for. `target` stays null more often than
 * not — most shows don't have a confident-enough signal, and the globe
 * just idles rather than pointing somewhere it isn't sure about.
 */
export function GlobeBackdrop({ target }: { target: Country | null }) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    reducedMotionRef.current =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  }, []);

  function onGlobeReady() {
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls();
    controls.autoRotate = !reducedMotionRef.current;
    controls.autoRotateSpeed = 0.35;
    controls.enableZoom = false;
    controls.enablePan = false;
    g.pointOfView({ altitude: 1.9 });
  }

  useEffect(() => {
    const g = globeRef.current;
    if (!g || !target) return;
    g.pointOfView({ lat: target.lat, lng: target.lon, altitude: 1.5 }, reducedMotionRef.current ? 0 : 1800);
  }, [target]);

  const points: CityPoint[] = target
    ? [...WORLD_CITIES, { lat: target.lat, lng: target.lon, city: target.name, size: 1.6, color: "#ff3b30" }]
    : WORLD_CITIES;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      <Globe
        ref={globeRef}
        onGlobeReady={onGlobeReady}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl={null}
        showAtmosphere
        atmosphereColor="#ff3b30"
        atmosphereAltitude={0.2}
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointColor={(d: object) => (d as CityPoint).color ?? "#a1a1aa"}
        pointRadius={(d: object) => (d as CityPoint).size ?? 0.35}
        pointAltitude={0.01}
        pointsMerge={false}
        pointLabel={(d: object) => (d as CityPoint).city}
        ringsData={target ? [{ lat: target.lat, lng: target.lon }] : []}
        ringLat="lat"
        ringLng="lng"
        ringColor={() => "#ff3b30"}
        ringMaxRadius={7}
        ringPropagationSpeed={2.5}
        ringRepeatPeriod={1000}
      />
    </div>
  );
}
