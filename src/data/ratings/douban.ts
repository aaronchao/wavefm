import { fetchWithTimeout, runLadder } from "./ladder";

/**
 * Douban rating for a show title. Douban has no official podcast API, so
 * every rung is best-effort scraping behind small adapters (Section 7):
 * unofficial JSON search -> public search-page parse -> null.
 */
export async function doubanRating(title: string): Promise<number | null> {
  const q = encodeURIComponent(title);
  return runLadder([
    // official API: none exists for podcasts — skip
    async () => null,
    // unofficial JSON search endpoint
    async () => {
      const res = await fetchWithTimeout(
        `https://www.douban.com/j/search?q=${q}&cat=1015`,
      );
      if (!res.ok) return null;
      const json = (await res.json()) as { items?: string[] };
      return extractRating(json.items?.join(" ") ?? "");
    },
    // public web-page parse
    async () => {
      const res = await fetchWithTimeout(
        `https://www.douban.com/search?cat=1015&q=${q}`,
      );
      if (!res.ok) return null;
      return extractRating(await res.text());
    },
  ]);
}

/** First rating-looking number in Douban markup, e.g. rating_nums">8.7<. */
function extractRating(html: string): number | null {
  const m = html.match(/rating_nums?['"]?>\s*([\d.]+)/);
  if (!m) return null;
  const rating = Number.parseFloat(m[1]);
  return rating >= 0 && rating <= 10 ? rating : null;
}
