import type { RatingResult } from "./provider";

/**
 * §5 P2: `json.ratings ?? []` lets a non-array truthy value (e.g. an
 * unexpected `{ratings: "error"}` shape from a proxy hiccup) through
 * unchanged — a React component calling `.map()` on that would throw. The
 * catalog client already coerces this way (see asArray in
 * src/data/catalog/client.ts); this is the same guard for the one client
 * this file's callers hit directly, without their own try/catch.
 */
function asRatings(v: unknown): RatingResult[] {
  return Array.isArray(v) ? (v as RatingResult[]) : [];
}

/** Browser client for /api/ratings. Failures = no badges, never an error. */
export async function getRatings(
  showId: string,
  title: string,
  sources?: string[],
): Promise<RatingResult[]> {
  if (sources && sources.length === 0) return [];
  try {
    const params = new URLSearchParams({ showId, title });
    if (sources) params.set("sources", sources.join(","));
    const res = await fetch(`/api/ratings?${params.toString()}`);
    if (!res.ok) return [];
    const json = (await res.json()) as Partial<{ ratings: RatingResult[] }>;
    return asRatings(json.ratings);
  } catch {
    return [];
  }
}
