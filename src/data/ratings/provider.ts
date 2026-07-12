import { doubanRating } from "./douban";
import { xiaoyuzhouRating } from "./xiaoyuzhou";

export type RatingSource = "douban" | "xiaoyuzhou";
export type RatingResult = { source: RatingSource; rating: number | null };

const PROVIDERS: Record<RatingSource, (title: string) => Promise<number | null>> = {
  douban: doubanRating,
  xiaoyuzhou: xiaoyuzhouRating,
};

export const ALL_SOURCES = Object.keys(PROVIDERS) as RatingSource[];

/** Runs the requested providers in parallel; each resolves or nulls. */
export async function fetchRatings(
  title: string,
  sources: RatingSource[] = ALL_SOURCES,
): Promise<RatingResult[]> {
  return Promise.all(
    sources.map(async (source) => ({
      source,
      rating: await PROVIDERS[source](title).catch(() => null),
    })),
  );
}
