import type { CatalogShow } from "@/src/data/catalog/types";

/**
 * Saved shows — localStorage-backed for M1 so saving works signed-out.
 * M2 re-backs this same interface with Supabase (and migrates local saves
 * on first sign-in). Whole CatalogShow objects are stored to make that
 * migration lossless.
 */

const KEY = "wavr.savedShows.v1";

export type SavedShow = { show: CatalogShow; savedAt: string };

function read(): SavedShow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedShow[]) : [];
  } catch {
    return [];
  }
}

function write(items: SavedShow[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // storage full/blocked — saving silently fails rather than crashing
  }
}

export function listSaved(): SavedShow[] {
  return read();
}

export function isSaved(showId: string): boolean {
  return read().some((s) => s.show.id === showId);
}

export function saveShow(show: CatalogShow): void {
  const items = read();
  if (items.some((s) => s.show.id === show.id)) return;
  write([{ show, savedAt: new Date().toISOString() }, ...items]);
}

export function unsaveShow(showId: string): void {
  write(read().filter((s) => s.show.id !== showId));
}
