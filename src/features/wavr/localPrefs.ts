"use client";

import { useSyncExternalStore } from "react";

/**
 * Wavr's own device-local toggles (haptics, WaveField) — deliberately NOT
 * synced via prefsRepo/Supabase: these are display/feel preferences tied to
 * this specific device (like the CORS-probe cache and fatigue impressions),
 * not taste data, so a schema migration isn't warranted for them.
 */

const KEY = "wavr.localPrefs.v1";

export type WavrLocalPrefs = { haptics: boolean; waveField: boolean };
const DEFAULTS: WavrLocalPrefs = { haptics: true, waveField: true };

function read(): WavrLocalPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<WavrLocalPrefs>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function write(next: WavrLocalPrefs) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

let state = DEFAULTS;
const listeners = new Set<() => void>();

export const wavrLocalPrefs = {
  get: (): WavrLocalPrefs => state,
  set(patch: Partial<WavrLocalPrefs>) {
    state = { ...state, ...patch };
    write(state);
    for (const l of listeners) l();
  },
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};

export function useWavrLocalPrefs(): WavrLocalPrefs {
  return useSyncExternalStore(wavrLocalPrefs.subscribe, wavrLocalPrefs.get, () => DEFAULTS);
}

if (typeof window !== "undefined") state = read();
