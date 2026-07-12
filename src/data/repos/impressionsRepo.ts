/**
 * Local impression counts (fatigue signal). Device-local by design —
 * "recently shown on this screen" shouldn't sync across devices, and it
 * keeps the free-tier event volume down.
 */

const KEY = "wavr.impressions.v1";
const MAX_ENTRIES = 500;

export function getImpressions(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function bumpImpressions(showIds: string[]): void {
  if (typeof window === "undefined" || showIds.length === 0) return;
  const counts = getImpressions();
  for (const id of showIds) counts[id] = (counts[id] ?? 0) + 1;
  const entries = Object.entries(counts);
  const kept = entries.length > MAX_ENTRIES ? entries.slice(-MAX_ENTRIES) : entries;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    // ignore
  }
}
