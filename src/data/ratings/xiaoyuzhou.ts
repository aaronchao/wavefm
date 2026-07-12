import { fetchWithTimeout, runLadder } from "./ladder";

/**
 * Xiaoyuzhou "rating" for a show title. XYZ exposes no official API and no
 * public numeric rating; the page-parse rung looks for a rating-shaped
 * field in the Next.js data blob if one ever appears. Usually resolves to
 * null — which the UI and recommender treat as neutral (Section 7).
 */
export async function xiaoyuzhouRating(title: string): Promise<number | null> {
  const q = encodeURIComponent(title);
  return runLadder([
    // official API: none — skip
    async () => null,
    // public search-page parse (__NEXT_DATA__ JSON blob)
    async () => {
      const res = await fetchWithTimeout(
        `https://www.xiaoyuzhoufm.com/search/${q}`,
      );
      if (!res.ok) return null;
      const html = await res.text();
      const m = html.match(/"(?:rating|score)"\s*:\s*([\d.]+)/);
      if (!m) return null;
      const rating = Number.parseFloat(m[1]);
      // XYZ scores, if present, are 0..5 — normalize to 0..10
      return rating > 0 && rating <= 5 ? rating * 2 : rating <= 10 ? rating : null;
    },
  ]);
}
