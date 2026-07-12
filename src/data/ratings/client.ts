import type { RatingResult } from "./provider";

/** Browser client for /api/ratings. Failures = no badges, never an error. */
export async function getRatings(
  showId: string,
  title: string,
): Promise<RatingResult[]> {
  try {
    const res = await fetch(
      `/api/ratings?showId=${encodeURIComponent(showId)}&title=${encodeURIComponent(title)}`,
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { ratings?: RatingResult[] };
    return json.ratings ?? [];
  } catch {
    return [];
  }
}
