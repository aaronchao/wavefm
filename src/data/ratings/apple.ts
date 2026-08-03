import { fetchWithTimeout } from "./ladder";

/**
 * Apple Podcasts rating for a show, from the free public customer-reviews
 * JSON feed (no key). The feed exposes no aggregate, so we average the recent
 * reviews' stars (1–5 → 0–10) — an honest best-effort quality score that the
 * English catalog otherwise lacks (parallel to Douban for Chinese shows).
 *
 * Needs the numeric iTunes id (the show's own id for iTunes-sourced shows),
 * so this provider takes `showId`; non-iTunes ids (pi-/rss-) return null.
 *
 * COUNTRY LADDER: reviews live per storefront. We try US first, then the
 * Chinese-language storefronts (TW/CN/HK), returning the first with enough
 * reviews — so English shows resolve on US and Chinese shows fall through to
 * where they're actually reviewed. Same podcast id across every storefront.
 */

const COUNTRIES = ["us", "tw", "cn", "hk"] as const;
const MIN_REVIEWS = 3; // below this a single grumpy review dominates — skip

type RssEntry = {
  "im:rating"?: { label?: string };
};

function isNumericId(id: string | undefined): id is string {
  return !!id && /^\d+$/.test(id);
}

/** Average star rating (0–10) from one storefront, or null if too few. */
async function ratingForCountry(country: string, id: string): Promise<number | null> {
  const res = await fetchWithTimeout(
    `https://itunes.apple.com/${country}/rss/customerreviews/page=1/id=${id}/sortby=mostrecent/json`,
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { feed?: { entry?: RssEntry | RssEntry[] } };
  const raw = json.feed?.entry;
  if (!raw) return null;
  // one review comes back as an object, many as an array; the summary entry
  // (the podcast itself) has no im:rating and is filtered out here
  const entries = Array.isArray(raw) ? raw : [raw];
  const stars = entries
    .map((e) => Number(e["im:rating"]?.label))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);
  if (stars.length < MIN_REVIEWS) return null;
  const avg5 = stars.reduce((s, n) => s + n, 0) / stars.length;
  return Math.round(avg5 * 2 * 10) / 10; // → 0..10, one decimal
}

export async function appleRating(
  _title: string,
  showId?: string,
): Promise<number | null> {
  if (!isNumericId(showId)) return null;
  for (const country of COUNTRIES) {
    try {
      const rating = await ratingForCountry(country, showId);
      if (rating != null) return rating;
    } catch {
      // storefront hiccup — try the next one
    }
  }
  return null;
}
