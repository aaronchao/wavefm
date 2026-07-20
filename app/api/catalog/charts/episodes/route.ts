import { NextResponse } from "next/server";
import { stableFeedId } from "@/src/core/opml";
import { xyzrankHotEpisodes } from "@/src/data/buzz/xyzrank";
import type { EpisodeChartsResponse } from "@/src/data/catalog/types";

/**
 * Proxy: 热门单集 — the hot-EPISODES board (中文播客榜's episode ranking,
 * built on 小宇宙 play/comment data). This is the only free per-episode
 * popularity board anywhere, so it stands alone beside the show charts.
 * Best-effort: unreachable board -> { episodes: [], degraded: true }.
 */
export async function GET(request: Request) {
  const limitParam = Number(new URL(request.url).searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 40) : 20;

  const eps = await xyzrankHotEpisodes();
  if (!eps) {
    const empty: EpisodeChartsResponse = { episodes: [], degraded: true };
    return NextResponse.json(empty, { status: 200 });
  }

  const response: EpisodeChartsResponse = {
    episodes: eps.slice(0, limit).map((e) => ({
      id: stableFeedId(`${e.showTitle ?? ""}|${e.title}`),
      title: e.title,
      showTitle: e.showTitle,
      url: e.url,
      why: whyFor(e.plays, e.comments),
    })),
    degraded: false,
  };
  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}

function compact(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return String(n);
}

function whyFor(plays?: number, comments?: number): string {
  const bits: string[] = [];
  if (plays != null) bits.push(`${compact(plays)} plays`);
  if (comments != null) bits.push(`${compact(comments)} comments`);
  return bits.length > 0 ? `${bits.join(" · ")} on 小宇宙` : "热门单集 on 小宇宙";
}
