import { NextResponse } from "next/server";
import { itunesId } from "@/src/core/links";
import { topPicks, type SimilarItemInput } from "@/src/core/recommend";
import { hackerNewsBuzz } from "@/src/data/buzz/hackernews";
import { listenNotesBuzz } from "@/src/data/buzz/listennotes";
import { pocketCastsTrendingRanks } from "@/src/data/buzz/pocketcasts";
import { redditBuzz } from "@/src/data/buzz/reddit";
import { mergeBuzz } from "@/src/data/buzz/xiaoyuzhou";
import { youtubeBuzz } from "@/src/data/buzz/youtube";
import {
  itunesTopChartRanks,
  itunesTopChartShows,
  piTrendingRanks,
} from "@/src/data/catalog/server";
import type { CatalogShow, GlobalChartsResponse } from "@/src/data/catalog/types";

/**
 * Proxy: the Global (English) chart — the top podcasts ranked by real
 * signal, not by us. Popularity/official standing comes from the Apple
 * top chart + Podcast Index trending; the human layer comes from Reddit
 * discussion + Listen Notes' Listen Score (a stream/engagement metric).
 * The pure ranker (topPicks with no seeds) blends them, leading each row
 * with its strongest human phrase. Best-effort: a dead upstream shrinks
 * the board, never errors.
 */
export async function GET(request: Request) {
  const limitParam = Number(new URL(request.url).searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 40) : 24;

  const [chartShows, chartRanks, trendRanks] = await Promise.all([
    itunesTopChartShows(),
    itunesTopChartRanks(),
    piTrendingRanks(),
  ]);

  if (!chartShows || chartShows.length === 0) {
    const empty: GlobalChartsResponse = { shows: [], degraded: true };
    return NextResponse.json(empty, { status: 200 });
  }

  const showById = new Map<string, CatalogShow>();
  for (const s of chartShows) if (!showById.has(s.id)) showById.set(s.id, s);

  const baseCandidates: SimilarItemInput[] = [...showById.values()].map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    categories: s.categories,
    lastEpisodeAt: s.lastEpisodeAt,
    episodeCount: s.episodeCount,
    chartRank: chartRanks?.get(s.id),
    trendRank: trendRanks?.get(s.id),
  }));

  // two passes: cheap popularity rank first, then Reddit + Listen Notes
  // only for the finalists that could make the board. Listen Notes is bounded
  // further to the top few — its free quota is tiny (see listennotes.ts).
  const shortlist = topPicks({ saved: [], candidates: baseCandidates, limit: Math.min(limit + 6, 40) });
  // Pocket Casts trending is one cached fetch for the whole shortlist.
  const pcRanks = await pocketCastsTrendingRanks();
  // Reddit + HN are free (all finalists); Listen Notes + YouTube are quota- or
  // key-bounded to the top few (see listennotes.ts / youtube.ts).
  const BOUNDED_CAP = 6;
  const enriched: SimilarItemInput[] = await Promise.all(
    shortlist.map(async (p, i) => {
      const bounded = i < BOUNDED_CAP;
      const pcId = itunesId(p.item.id);
      const pocketCasts =
        pcId && pcRanks?.has(pcId) ? { pocketCastsRank: pcRanks.get(pcId) } : null;
      const [reddit, hn, listen, youtube] = await Promise.all([
        redditBuzz(p.item.title),
        hackerNewsBuzz(p.item.title),
        bounded ? listenNotesBuzz(p.item.title) : Promise.resolve(null),
        bounded ? youtubeBuzz(p.item.title) : Promise.resolve(null),
      ]);
      return { ...p.item, buzz: mergeBuzz(p.item.buzz, listen, youtube, pocketCasts, reddit, hn) };
    }),
  );
  const finalists = topPicks({ saved: [], candidates: enriched, limit });

  const response: GlobalChartsResponse = {
    shows: finalists.map((p) => ({ ...showById.get(p.item.id)!, why: p.why })),
    degraded: false,
  };
  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}
