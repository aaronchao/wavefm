import { NextResponse } from "next/server";
import { topPicks, type SimilarItemInput } from "@/src/core/recommend";
import { normalizeForMatch } from "@/src/data/buzz/match";
import { xyzrankChart, type XyzChartEntry } from "@/src/data/buzz/xyzrank";
import {
  itunesSearch,
  itunesTopChartRanks,
  itunesTopChartShows,
} from "@/src/data/catalog/server";
import type { CatalogShow, ChineseChartsResponse } from "@/src/data/catalog/types";

/**
 * Proxy: 中文播客榜 — the top Chinese podcasts, ranked. Reliability first:
 * the base pool is Apple's CN storefront top chart (the same free RSS the
 * Global board uses, so this board populates whenever that one does).
 * On top of that we layer 中文播客榜 (xyzrank.com) — its 小宇宙 subscriber /
 * play / comment stats become the discussion signal that drives ordering,
 * and any of its shows missing from the Apple chart are resolved in too.
 * xyzrank sits behind a bot filter, so it's strictly best-effort: when it's
 * unreachable the board still stands on the Apple CN chart, never empty.
 */
export async function GET(request: Request) {
  const limitParam = Number(new URL(request.url).searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 40) : 24;

  const [chartShows, chartRanks, xyzChart] = await Promise.all([
    itunesTopChartShows("cn"),
    itunesTopChartRanks("cn"),
    xyzrankChart(),
  ]);

  const showById = new Map<string, CatalogShow>();
  for (const s of chartShows ?? []) if (!showById.has(s.id)) showById.set(s.id, s);

  // pull in xyzrank's own leaderboard shows that aren't on the Apple chart
  const xyz = xyzChart ?? [];
  if (xyz.length > 0) {
    const resolved = await Promise.all(
      xyz.slice(0, limit).map((e) => resolveEntry(e)),
    );
    for (const s of resolved) if (s && !showById.has(s.id)) showById.set(s.id, s);
  }

  if (showById.size === 0) {
    const empty: ChineseChartsResponse = { shows: [], degraded: true };
    return NextResponse.json(empty, { status: 200 });
  }

  // 小宇宙 stats by normalized title -> the discussion signal for ranking
  const xyzByTitle = new Map<string, XyzChartEntry>();
  for (const e of xyz) xyzByTitle.set(normalizeForMatch(e.title), e);

  const candidates: SimilarItemInput[] = [...showById.values()].map((s) => {
    const x = xyzByTitle.get(normalizeForMatch(s.title));
    return {
      id: s.id,
      title: s.title,
      description: s.description,
      categories: s.categories,
      lastEpisodeAt: s.lastEpisodeAt,
      episodeCount: s.episodeCount,
      chartRank: chartRanks?.get(s.id),
      buzz: x
        ? {
            xyzrankRank: x.rank,
            subscribers: x.subscribers,
            plays: x.plays,
            comments: x.comments,
          }
        : undefined,
    };
  });

  const ranked = topPicks({ saved: [], candidates, limit });
  // This board IS 小宇宙 — the "why" speaks 小宇宙, never "#x on Apple charts"
  // (the Apple CN chart is only the reliability backbone underneath).
  const response: ChineseChartsResponse = {
    shows: ranked.map((p) => ({
      ...showById.get(p.item.id)!,
      why: xiaoyuzhouWhy(p.item.buzz),
    })),
    degraded: false,
  };
  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=172800",
    },
  });
}

function compact(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}w`; // 万
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return String(n);
}

/** 小宇宙-native reason line for a board row. */
function xiaoyuzhouWhy(b: SimilarItemInput["buzz"]): string {
  const bits: string[] = [];
  if (b?.xyzrankRank != null) bits.push(`#${b.xyzrankRank} on 小宇宙`);
  if (b?.subscribers != null) bits.push(`${compact(b.subscribers)} subscribers`);
  else if (b?.comments != null) bits.push(`${compact(b.comments)} comments`);
  else if (b?.plays != null) bits.push(`${compact(b.plays)} plays`);
  return bits.length > 0 ? bits.join(" · ") : "热门中文播客";
}

/** Resolve a 中文播客榜 title to a CN-storefront catalog show, if it exists. */
async function resolveEntry(entry: XyzChartEntry): Promise<CatalogShow | null> {
  const results = await itunesSearch(entry.title, "cn");
  if (!results || results.length === 0) return null;
  const key = normalizeForMatch(entry.title);
  return results.find((s) => normalizeForMatch(s.title) === key) ?? results[0];
}
