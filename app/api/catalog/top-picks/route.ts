import { NextResponse } from "next/server";
import {
  detectLang,
  queryTermsForShow,
  rankByDiscussion,
  shouldLanguageFilter,
  topPicks,
  type SimilarItemInput,
} from "@/src/core/recommend";
import { dcardDiscussion } from "@/src/data/buzz/dcard";
import {
  doubanGroupDiscussion,
  lihkgDiscussion,
  pttDiscussion,
} from "@/src/data/buzz/forums";
import { listenNotesBuzz } from "@/src/data/buzz/listennotes";
import { redditDiscussion } from "@/src/data/buzz/reddit";
import { v2exDiscussion } from "@/src/data/buzz/v2ex";
import { mergeBuzz, xiaoyuzhouBuzz } from "@/src/data/buzz/xiaoyuzhou";
import { xyzrankBuzz } from "@/src/data/buzz/xyzrank";
import { lookupShow } from "@/src/data/catalog/lookup";
import {
  itunesSearch,
  itunesTopChartRanks,
  piTrendingRanks,
} from "@/src/data/catalog/server";
import type {
  CatalogShow,
  EvidenceItem,
  TopPicksResponse,
} from "@/src/data/catalog/types";

/**
 * Proxy: Top Picks — the shows communities actually talk about, NOT the
 * charts. People come to Wavr because Apple/Spotify charts didn't help, so:
 *   • candidates come from topical/interest search, never the top chart;
 *   • each finalist is enriched with real discussion (Reddit + V2EX + 小宇宙),
 *     and must have some to qualify;
 *   • shows currently on a mainstream chart are penalised (already seen);
 *   • "under the radar" gems (well-discussed, low-popularity) are favoured.
 * Every upstream is best-effort — a dead one shrinks the pool, never errors.
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

  // keep picks in the seed's language (a Chinese seed gets Chinese neighbours)
  const seedLang = seeds[0]
    ? detectLang(`${seeds[0].title} ${seeds[0].description ?? ""}`)
    : "en";
  const languageLocked = shouldLanguageFilter(seedLang);
  const storefront = seedLang === "zh" ? "cn" : seedLang === "ja" ? "jp" : seedLang === "ko" ? "kr" : undefined;

  // Candidate pool is topical search only — deliberately NOT the top chart.
  // We still fetch the chart/trend ranks, but only to KNOW which candidates
  // are charted so we can push them down.
  const [chartRanks, trendRanks, topicShows, storefrontShows, ...categoryResults] =
    await Promise.all([
      itunesTopChartRanks(),
      piTrendingRanks(),
      topicQuery ? itunesSearch(topicQuery) : Promise.resolve(null),
      topicQuery && storefront ? itunesSearch(topicQuery, storefront) : Promise.resolve(null),
      ...seedCategories.map((c) => itunesSearch(c!, storefront)),
    ]);

  const degraded =
    topicShows === null && storefrontShows === null &&
    categoryResults.every((r) => r === null);

  const showById = new Map<string, CatalogShow>();
  for (const s of [
    ...(topicShows ?? []),
    ...(storefrontShows ?? []),
    ...categoryResults.flatMap((r) => r ?? []),
  ]) {
    if (!showById.has(s.id)) showById.set(s.id, s);
  }

  // drop cross-language stragglers for a CJK seed; keep the pool non-empty
  const inLanguage = (s: CatalogShow) =>
    !languageLocked || detectLang(`${s.title} ${s.description ?? ""}`) === seedLang;
  const pooled = [...showById.values()];
  const langPool = pooled.filter(inLanguage);
  const finalPool = (langPool.length > 0 ? langPool : pooled).slice(0, 14);

  const seedInputs = seeds.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    categories: s.categories,
  }));

  // enrich the shortlist with real community discussion (cached daily) —
  // counts AND the actual threads for readable evidence — and mark whichever
  // are currently charted so the ranker can penalise them
  const evidenceById = new Map<string, EvidenceItem[]>();
  const candidates: SimilarItemInput[] = await Promise.all(
    finalPool.map(async (s) => {
      const [xyz, reddit, v2ex, dcard, ptt, lihkg, douban, xiaoyuzhou, listen] =
        await Promise.all([
          xyzrankBuzz(s.title),
          redditDiscussion(s.title),
          v2exDiscussion(s.title),
          dcardDiscussion(s.title),
          pttDiscussion(s.title),
          lihkgDiscussion(s.title),
          doubanGroupDiscussion(s.title),
          xiaoyuzhouBuzz(s.title),
          listenNotesBuzz(s.title),
        ]);
      const evidence = [
        ...(reddit?.evidence ?? []),
        ...(douban?.evidence ?? []),
        ...(dcard?.evidence ?? []),
        ...(ptt?.evidence ?? []),
        ...(lihkg?.evidence ?? []),
        ...(v2ex?.evidence ?? []),
      ].slice(0, 4);
      if (evidence.length > 0) evidenceById.set(s.id, evidence);
      return {
        id: s.id,
        title: s.title,
        description: s.description,
        categories: s.categories,
        lastEpisodeAt: s.lastEpisodeAt,
        episodeCount: s.episodeCount,
        chartRank: chartRanks?.get(s.id),
        trendRank: trendRanks?.get(s.id),
        buzz: mergeBuzz(
          xyz,
          listen,
          xiaoyuzhou,
          douban?.buzz,
          dcard?.buzz,
          ptt?.buzz,
          lihkg?.buzz,
          v2ex?.buzz,
          reddit?.buzz,
        ),
      };
    }),
  );

  // discussion-first, anti-chart. Fall back to the quality ranker only when
  // no candidate has any discussion at all, so the shelf is never empty.
  const discussed = rankByDiscussion({ saved: seedInputs, candidates, limit: 12 });
  const finalists = discussed.length > 0
    ? discussed.map((p) => ({ id: p.item.id, why: p.why }))
    : topPicks({ saved: seedInputs, candidates, limit: 10 }).map((p) => ({
        id: p.item.id,
        why: p.why,
      }));

  const response: TopPicksResponse = {
    picks: finalists.map((p) => ({
      ...showById.get(p.id)!,
      why: p.why,
      evidence: evidenceById.get(p.id),
    })),
    degraded,
  };

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}
