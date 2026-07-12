import type { RatingResult } from "./provider";

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
    const json = (await res.json()) as { ratings?: RatingResult[] };
    return json.ratings ?? [];
  } catch {
    return [];
  }
}
