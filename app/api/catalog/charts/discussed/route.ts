import { NextResponse } from "next/server";
import { rankByDiscussion, type SimilarItemInput } from "@/src/core/recommend";
import { listenNotesBuzz } from "@/src/data/buzz/listennotes";
import { normalizeForMatch } from "@/src/data/buzz/match";
import { redditDiscussion } from "@/src/data/buzz/reddit";
import { v2exDiscussion } from "@/src/data/buzz/v2ex";
import { mergeBuzz, xiaoyuzhouBuzz } from "@/src/data/buzz/xiaoyuzhou";
import { xyzrankBuzz, xyzrankChart } from "@/src/data/buzz/xyzrank";
import {
  itunesSearch,
  itunesTopChartRanks,
  piTrendingRanks,
  piTrendingShows,
} from "@/src/data/catalog/server";
import type {
  CatalogShow,
  DiscussedChartsResponse,
  EvidenceItem,
} from "@/src/data/catalog/types";

/**
 * Proxy: 社区热议 / Discussed — a community chart ranked by real discussion
 * (Reddit + V2EX + 小宇宙), deliberately NOT the Apple chart. The pool is
 * independent/community sources — Podcast Index trending + the 中文播客榜
 * (小宇宙) leaderboard — enriched with discussion, then ranked discussion-first
 * with Apple-charted shows penalised. This is the "what people actually talk
 * about" board. Best-effort throughout; a dead upstream shrinks it, never errors.
 */
export async function GET(request: Request) {
  const limitParam = Number(new URL(request.url).searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 40) : 24;

  const [piShows, xyzChart, chartRanks, trendRanks] = await Promise.all([
    piTrendingShows(),
    xyzrankChart(),
    itunesTopChartRanks(),
    piTrendingRanks(),
  ]);

  const showById = new Map<string, CatalogShow>();
  for (const s of piShows ?? []) if (!showById.has(s.id)) showById.set(s.id, s);

  // add 中文播客榜 (小宇宙) shows resolved to the catalog — the zh community pool
  const xyz = xyzChart ?? [];
  if (xyz.length > 0) {
    const resolved = await Promise.all(
      xyz.slice(0, 12).map(async (e) => {
        const results = await itunesSearch(e.title, "cn");
        if (!results || results.length === 0) return null;
        const key = normalizeForMatch(e.title);
        return results.find((s) => normalizeForMatch(s.title) === key) ?? results[0];
      }),
    );
    for (const s of resolved) if (s && !showById.has(s.id)) showById.set(s.id, s);
  }

  const pool = [...showById.values()].slice(0, 24);
  if (pool.length === 0) {
    const empty: DiscussedChartsResponse = { shows: [], degraded: true };
    return NextResponse.json(empty, { status: 200 });
  }

  const evidenceById = new Map<string, EvidenceItem[]>();
  const candidates: SimilarItemInput[] = await Promise.all(
    pool.map(async (s) => {
      const [xyzBuzz, reddit, v2ex, xiaoyuzhou, listen] = await Promise.all([
        xyzrankBuzz(s.title),
        redditDiscussion(s.title),
        v2exDiscussion(s.title),
        xiaoyuzhouBuzz(s.title),
        listenNotesBuzz(s.title),
      ]);
      const evidence = [...(reddit?.evidence ?? []), ...(v2ex?.evidence ?? [])].slice(0, 3);
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
        buzz: mergeBuzz(xyzBuzz, listen, xiaoyuzhou, v2ex?.buzz, reddit?.buzz),
      };
    }),
  );

  const ranked = rankByDiscussion({ saved: [], candidates, limit });
  const response: DiscussedChartsResponse = {
    shows: ranked.map((p) => ({
      ...showById.get(p.item.id)!,
      why: p.why,
      evidence: evidenceById.get(p.item.id),
    })),
    degraded: false,
  };
  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}
