import { NextResponse } from "next/server";
import {
  queryTermsForShow,
  topPicks,
  type SimilarItemInput,
} from "@/src/core/recommend";
import { listenNotesBuzz } from "@/src/data/buzz/listennotes";
import { redditBuzz } from "@/src/data/buzz/reddit";
import { mergeBuzz, xiaoyuzhouBuzz } from "@/src/data/buzz/xiaoyuzhou";
import { xyzrankBuzz } from "@/src/data/buzz/xyzrank";
import { lookupShow } from "@/src/data/catalog/lookup";
import {
  itunesSearch,
  itunesTopChartRanks,
  itunesTopChartShows,
  piTrendingRanks,
} from "@/src/data/catalog/server";
import type { CatalogShow, TopPicksResponse } from "@/src/data/catalog/types";

/**
 * Proxy: Top Picks — highly rated / heavily discussed shows curated for
 * the user's saved shows (?seeds=id1,id2,…). Candidates come from the
 * Apple top chart + iTunes searches around the seeds; quality signals
 * from chart/trending ranks and discussion buzz (中文播客榜 for every
 * candidate; Reddit + 小宇宙 for the finalists, cached daily). Every
 * upstream is best-effort — a dead one shrinks the pool, never errors.
 */
export async function GET(request: Request) {
  const seedsParam = new URL(request.url).searchParams.get("seeds") ?? "";
  const seedIds = seedsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4);

  const seeds = (await Promise.all(seedIds.map((id) => lookupShow(id)))).filter(
    (s): s is CatalogShow => s !== null,
  );

  const seedCategories = [...new Set(seeds.map((s) => s.categories[0]).filter(Boolean))]
    .slice(0, 3);
  const topicQuery = seeds[0] ? queryTermsForShow(seeds[0], 4).join(" ") : null;

  const [chartShows, chartRanks, trendRanks, topicShows, ...categoryResults] =
    await Promise.all([
      itunesTopChartShows(),
      itunesTopChartRanks(),
      piTrendingRanks(),
      topicQuery ? itunesSearch(topicQuery) : Promise.resolve(null),
      ...seedCategories.map((c) => itunesSearch(c!)),
    ]);

  const degraded = chartShows === null && topicShows === null &&
    categoryResults.every((r) => r === null);

  const showById = new Map<string, CatalogShow>();
  for (const s of [
    ...(chartShows ?? []),
    ...(topicShows ?? []),
    ...categoryResults.flatMap((r) => r ?? []),
  ]) {
    if (!showById.has(s.id)) showById.set(s.id, s);
  }

  // 中文播客榜 buzz is one cached index — attach it to every candidate
  const candidates: SimilarItemInput[] = await Promise.all(
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

  const seedInputs = seeds.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    categories: s.categories,
  }));

  // two passes: cheap rank first, then Reddit/小宇宙 only for finalists
  const shortlist = topPicks({ saved: seedInputs, candidates, limit: 15 });
  const enriched: SimilarItemInput[] = await Promise.all(
    shortlist.map(async (p) => {
      const [reddit, xyz, listen] = await Promise.all([
        redditBuzz(p.item.title),
        xiaoyuzhouBuzz(p.item.title),
        listenNotesBuzz(p.item.title),
      ]);
      return { ...p.item, buzz: mergeBuzz(p.item.buzz, listen, xyz, reddit) };
    }),
  );
  const finalists = topPicks({ saved: seedInputs, candidates: enriched, limit: 10 });

  const response: TopPicksResponse = {
    picks: finalists.map((p) => ({ ...showById.get(p.item.id)!, why: p.why })),
    degraded,
  };

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}
