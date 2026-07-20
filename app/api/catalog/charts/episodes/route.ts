import { NextResponse } from "next/server";
import { stableFeedId } from "@/src/core/opml";
import { xyzrankHotEpisodes } from "@/src/data/buzz/xyzrank";
import { itunesEpisodeSearch } from "@/src/data/catalog/server";
import type {
  ChartEpisodeItem,
  EpisodeChartsResponse,
} from "@/src/data/catalog/types";

/**
 * Proxy: 热门单集 — the hot-EPISODES board. Primary source is 中文播客榜's
 * episode ranking (小宇宙 play/comment data), the only free per-episode
 * popularity board anywhere. That host 403s bare server fetches, so when it's
 * unreachable we fall back to a key-free iTunes episode search across a few
 * topical queries (ranked newest-first) — the column stays populated instead
 * of vanishing beside the show charts. Only truly empty when both fail.
 */
const FALLBACK_QUERIES = ["访谈", "故事", "storytelling", "科技", "true crime", "商业"];

export async function GET(request: Request) {
  const limitParam = Number(new URL(request.url).searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 40) : 20;

  const eps = await xyzrankHotEpisodes();
  if (eps && eps.length > 0) {
    return json({
      episodes: eps.slice(0, limit).map((e) => ({
        id: stableFeedId(`${e.showTitle ?? ""}|${e.title}`),
        title: e.title,
        showTitle: e.showTitle,
        url: e.url,
        why: whyForXyz(e.plays, e.comments),
      })),
      degraded: false,
    });
  }

  // Fallback: key-free iTunes episodes, newest-first, deduped by title.
  const lists = await Promise.all(FALLBACK_QUERIES.map((q) => itunesEpisodeSearch(q)));
  const seen = new Set<string>();
  const scored: { row: ChartEpisodeItem; ts: number }[] = [];
  for (const list of lists) {
    for (const ep of list ?? []) {
      const key = ep.title.trim().toLowerCase();
      if (!ep.title.trim() || seen.has(key)) continue;
      seen.add(key);
      scored.push({
        ts: ep.publishedAt ? Date.parse(ep.publishedAt) || 0 : 0,
        row: {
          id: ep.id,
          title: ep.title,
          showTitle: ep.showTitle,
          url: ep.appleUrl,
          why: whyForFresh(ep.publishedAt),
        },
      });
    }
  }
  if (scored.length === 0) {
    return json({ episodes: [], degraded: true });
  }
  scored.sort((a, b) => b.ts - a.ts);
  return json({ episodes: scored.slice(0, limit).map((s) => s.row), degraded: false });
}

function json(body: EpisodeChartsResponse) {
  return NextResponse.json(body, {
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

function whyForXyz(plays?: number, comments?: number): string {
  const bits: string[] = [];
  if (plays != null) bits.push(`${compact(plays)} plays`);
  if (comments != null) bits.push(`${compact(comments)} comments`);
  return bits.length > 0 ? `${bits.join(" · ")} on 小宇宙` : "热门单集 on 小宇宙";
}

function whyForFresh(publishedAt?: string): string {
  if (!publishedAt) return "Trending episode";
  const days = Math.floor((Date.now() - Date.parse(publishedAt)) / 86_400_000);
  if (Number.isNaN(days)) return "Trending episode";
  if (days <= 1) return "Fresh today";
  if (days <= 7) return "New this week";
  if (days <= 30) return "New this month";
  return "Popular episode";
}
