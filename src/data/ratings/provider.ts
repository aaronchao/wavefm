import { appleRating } from "./apple";
import { doubanRating } from "./douban";
import { xiaoyuzhouRating } from "./xiaoyuzhou";

export type RatingSource = "apple" | "douban" | "xiaoyuzhou";
export type RatingResult = { source: RatingSource; rating: number | null };

/**
 * Each provider gets the title and the show id — Apple keys off the numeric
 * iTunes id, the scraping providers off the title. The extra arg is harmless
 * to the ones that ignore it.
 */
const PROVIDERS: Record<
  RatingSource,
  (title: string, showId?: string) => Promise<number | null>
> = {
  apple: appleRating,
  douban: doubanRating,
  xiaoyuzhou: xiaoyuzhouRating,
};

export const ALL_SOURCES = Object.keys(PROVIDERS) as RatingSource[];

/** Runs the requested providers in parallel; each resolves or nulls. */
export async function fetchRatings(
  title: string,
  sources: RatingSource[] = ALL_SOURCES,
  showId?: string,
): Promise<RatingResult[]> {
  return Promise.all(
    sources.map(async (source) => ({
      source,
      rating: await PROVIDERS[source](title, showId).catch(() => null),
    })),
  );
}
