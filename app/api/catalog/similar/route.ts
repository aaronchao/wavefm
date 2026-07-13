import { NextResponse } from "next/server";
import {
  queryTermsForShow,
  rankSimilar,
  type SimilarItemInput,
} from "@/src/core/recommend";
import { xyzrankBuzz } from "@/src/data/buzz/xyzrank";
import { lookupShowEnriched } from "@/src/data/catalog/lookup";
import {
  itunesEpisodeSearch,
  itunesSearch,
  itunesTopChartRanks,
  piSearch,
  piTrendingRanks,
} from "@/src/data/catalog/server";
import type {
  CatalogEpisode,
  CatalogShow,
  SimilarResponse,
} from "@/src/data/catalog/types";

/**
 * Proxy: "more like this" for a show — similar shows AND similar
 * episodes, ranked by TF-IDF similarity blended with free popularity
 * metrics (Apple chart rank, Podcast Index trending rank, episode
 * count, recency). Every upstream is best-effort; a dead provider
 * shrinks the candidate pool, it never errors the response.
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const seed = await lookupShowEnriched(id);
  if (!seed) {
    const empty: SimilarResponse = { shows: [], episodes: [], degraded: true };
    return NextResponse.json(empty, { status: 200 });
  }

  const topicQuery = queryTermsForShow(seed, 5).join(" ") || seed.title;
  const categoryQuery = seed.categories[0];

  const [byTopic, byCategory, byPi, episodeResults, chartRanks, trendRanks] =
    await Promise.all([
      itunesSearch(topicQuery),
      categoryQuery ? itunesSearch(categoryQuery) : Promise.resolve(null),
      piSearch(topicQuery),
      itunesEpisodeSearch(topicQuery),
      itunesTopChartRanks(),
      piTrendingRanks(),
    ]);

  const degraded =
    byTopic === null && byCategory === null && byPi === null &&
    episodeResults === null;

  // dedupe candidate shows by id, first source wins (iTunes topical first)
  const showById = new Map<string, CatalogShow>();
  for (const s of [...(byTopic ?? []), ...(byCategory ?? []), ...(byPi ?? [])]) {
    if (!showById.has(s.id)) showById.set(s.id, s);
  }

  // 中文播客榜 buzz is one cached index fetch — cheap enough for all
  const showCandidates: SimilarItemInput[] = await Promise.all(
    [...showById.values()].map(async (s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      categories: s.categories,
      lastEpisodeAt: s.lastEpisodeAt,
      episodeCount: s.episodeCount,
      chartRank: chartRanks?.get(s.id),
      trendRank: trendRanks?.get(s.id),
      buzz: (await xyzrankBuzz(s.title)) ?? undefined,
    })),
  );

  const episodeById = new Map<string, CatalogEpisode>();
  for (const e of episodeResults ?? []) {
    if (!episodeById.has(e.id)) episodeById.set(e.id, e);
  }

  const episodeCandidates: SimilarItemInput[] = [...episodeById.values()]
    // episodes of the seed show itself aren't "similar content"
    .filter((e) => e.showId !== seed.id)
    .map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      categories: e.categories,
      lastEpisodeAt: e.publishedAt,
      // an episode inherits its parent show's popularity rank
      chartRank: e.showId ? chartRanks?.get(e.showId) : undefined,
      trendRank: e.showId ? trendRanks?.get(e.showId) : undefined,
    }));

  const seedInput = {
    id: seed.id,
    title: seed.title,
    description: seed.description,
    categories: seed.categories,
  };

  const response: SimilarResponse = {
    shows: rankSimilar(seedInput, showCandidates, { limit: 10 }).map((r) => ({
      ...showById.get(r.item.id)!,
      why: r.why,
    })),
    episodes: rankSimilar(seedInput, episodeCandidates, { limit: 10 }).map(
      (r) => ({ ...episodeById.get(r.item.id)!, why: r.why }),
    ),
    degraded,
  };

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
