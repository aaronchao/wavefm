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
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    // Validated, not cast. This feeds the scoring pipeline as a fatigue
    // penalty, so a non-numeric value from storage would propagate NaN
    // through every candidate's score and silently scramble the ranking —
    // a corrupted key here is worth dropping, never trusting.
    const out: Record<string, number> = {};
    for (const [id, count] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof count === "number" && Number.isFinite(count) && count > 0) {
        out[id] = count;
      }
    }
    return out;
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
