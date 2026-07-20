import { NextResponse } from "next/server";
import { rankByDiscussion, topPicks, type SimilarItemInput } from "@/src/core/recommend";
import { dcardDiscussion } from "@/src/data/buzz/dcard";
import {
  doubanGroupDiscussion,
  lihkgDiscussion,
  pttDiscussion,
} from "@/src/data/buzz/forums";
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
 * (Reddit + V2EX + 小宇宙), deliberately NOT the Apple top chart. The pool is
 * built from a reliable, key-free backbone (iTunes topical catalog search,
 * bilingual) widened with independent/community sources when reachable
 * (Podcast Index trending + the 中文播客榜/小宇宙 leaderboard). Candidates are
 * enriched with discussion and ranked discussion-first, Apple-charted shows
 * penalised. If no discussion signal is reachable at all (some hosts block
 * Reddit), it falls back to the non-chart quality ranker so the board is
 * never empty. Best-effort throughout — a dead upstream shrinks it, never errors.
 */
const POOL_QUERIES = [
  "storytelling",
  "technology",
  "true crime",
  "society culture",
  "商业 访谈",
  "文化 生活",
];

export async function GET(request: Request) {
  const limitParam = Number(new URL(request.url).searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 40) : 24;

  const [topicResults, piShows, xyzChart, chartRanks, trendRanks] = await Promise.all([
    Promise.all(POOL_QUERIES.map((q) => itunesSearch(q))),
    piTrendingShows(),
    xyzrankChart(),
    itunesTopChartRanks(),
    piTrendingRanks(),
  ]);

  const showById = new Map<string, CatalogShow>();
  // reliable backbone first
  for (const list of topicResults) {
    for (const s of list ?? []) if (!showById.has(s.id)) showById.set(s.id, s);
  }
  for (const s of piShows ?? []) if (!showById.has(s.id)) showById.set(s.id, s);

  // widen with the 中文播客榜 (小宇宙) leaderboard resolved to the catalog
  const xyz = xyzChart ?? [];
  if (xyz.length > 0) {
    const resolved = await Promise.all(
      xyz.slice(0, 10).map(async (e) => {
        const results = await itunesSearch(e.title, "cn");
        if (!results || results.length === 0) return null;
        const key = normalizeForMatch(e.title);
        return results.find((s) => normalizeForMatch(s.title) === key) ?? results[0];
      }),
    );
    for (const s of resolved) if (s && !showById.has(s.id)) showById.set(s.id, s);
  }

  const pool = [...showById.values()].slice(0, 16);
  if (pool.length === 0) {
    const empty: DiscussedChartsResponse = { shows: [], degraded: true };
    return NextResponse.json(empty, { status: 200 });
  }

  const evidenceById = new Map<string, EvidenceItem[]>();
  const candidates: SimilarItemInput[] = await Promise.all(
    pool.map(async (s) => {
      const [xyzBuzz, reddit, v2ex, dcard, ptt, lihkg, douban, xiaoyuzhou, listen] =
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
          xyzBuzz,
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

  // discussion-first; if no discussion signal is reachable at all, fall back
  // to the quality ranker (off-chart preferred, but never an empty board)
  const discussed = rankByDiscussion({ saved: [], candidates, limit });
  const quality = topPicks({ saved: [], candidates, limit });
  const offChart = quality.filter(
    (p) => p.item.chartRank == null && p.item.trendRank == null,
  );
  const rows = (
    discussed.length > 0
      ? discussed.map((p) => ({ id: p.item.id, why: p.why }))
      : (offChart.length > 0 ? offChart : quality).map((p) => ({
          id: p.item.id,
          why: p.why,
        }))
  );

  const response: DiscussedChartsResponse = {
    shows: rows.map((r) => ({
      ...showById.get(r.id)!,
      why: r.why,
      evidence: evidenceById.get(r.id),
    })),
    degraded: false,
  };
  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}
