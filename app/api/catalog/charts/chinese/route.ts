import { NextResponse } from "next/server";
import { normalizeForMatch } from "@/src/data/buzz/match";
import { xyzrankChart, type XyzChartEntry } from "@/src/data/buzz/xyzrank";
import { itunesSearch } from "@/src/data/catalog/server";
import type { ChineseChartsResponse, CatalogShow } from "@/src/data/catalog/types";

/**
 * Proxy: 中文播客榜 — the top Chinese podcasts as ranked by xyzrank.com
 * (built on 小宇宙 + Apple data), resolved to Wavr catalog shows so each
 * is playable, saveable, and openable to its episodes. The leaderboard
 * supplies the order and the 小宇宙 stats; the CN storefront supplies art
 * and a stable id. Best-effort: an unreachable board or storefront simply
 * shrinks the list, never errors.
 */
export async function GET(request: Request) {
  const limitParam = Number(new URL(request.url).searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 40) : 24;

  const chart = await xyzrankChart();
  if (!chart) {
    const empty: ChineseChartsResponse = { shows: [], degraded: true };
    return NextResponse.json(empty, { status: 200 });
  }

  const top = chart.slice(0, limit);
  const resolved = await Promise.all(top.map((entry) => resolveEntry(entry)));

  const byId = new Map<string, ChineseChartsResponse["shows"][number]>();
  for (const show of resolved) {
    if (show && !byId.has(show.id)) byId.set(show.id, show);
  }

  const response: ChineseChartsResponse = {
    shows: [...byId.values()],
    degraded: false,
  };
  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=172800",
    },
  });
}

async function resolveEntry(
  entry: XyzChartEntry,
): Promise<ChineseChartsResponse["shows"][number] | null> {
  const results = await itunesSearch(entry.title, "cn");
  if (!results || results.length === 0) return null;
  const key = normalizeForMatch(entry.title);
  const match =
    results.find((s) => normalizeForMatch(s.title) === key) ?? results[0];
  return { ...(match as CatalogShow), why: whyFor(entry) };
}

function compact(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}w`; // 万
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return String(n);
}

function whyFor(entry: XyzChartEntry): string {
  const bits = [`#${entry.rank} on 中文播客榜`];
  if (entry.subscribers) bits.push(`${compact(entry.subscribers)} subscribers`);
  else if (entry.comments) bits.push(`${compact(entry.comments)} comments`);
  return bits.join(" · ");
}
