import { NextResponse } from "next/server";
import { stableFeedId } from "@/src/core/opml";
import { normalizeForMatch } from "@/src/data/buzz/match";
import {
  xyzrankChart,
  xyzrankHotEpisodes,
  xyzrankNewEpisodes,
  xyzrankNewPodcasts,
  type XyzChartEntry,
  type XyzEpisodeEntry,
} from "@/src/data/buzz/xyzrank";
import { itunesSearch } from "@/src/data/catalog/server";
import type {
  CatalogShow,
  SimilarShow,
  XyzrankBoardResponse,
  XyzrankEpisodeItem,
  XyzrankTab,
} from "@/src/data/catalog/types";

/**
 * Proxy: xyzrank.com's own four boards, verbatim — see src/data/buzz/xyzrank.ts
 * for the endpoint mapping. Unlike the blended Chinese/episode charts
 * elsewhere in /api/catalog/charts, this keeps xyzrank's own rank order
 * rather than re-scoring through topPicks(), since the point of this
 * section is showing that site's rankings specifically. Each entry is
 * resolved to a real catalog show (iTunes CN search) so Save/OpenInLinks
 * work the same as everywhere else in the app; unresolved entries are
 * dropped rather than shown as dead rows.
 */
const TABS: XyzrankTab[] = ["podcasts", "new-podcasts", "episodes", "new-episodes"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tabParam = url.searchParams.get("tab");
  const tab: XyzrankTab = (TABS as string[]).includes(tabParam ?? "")
    ? (tabParam as XyzrankTab)
    : "podcasts";
  const limitParam = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 40) : 20;

  if (tab === "podcasts" || tab === "new-podcasts") {
    const entries = tab === "podcasts" ? await xyzrankChart() : await xyzrankNewPodcasts();
    if (!entries || entries.length === 0) {
      return json({ tab, shows: [], episodes: [], degraded: true });
    }
    const paired = await Promise.all(
      entries.slice(0, limit).map(async (e) => ({ e, show: await resolveShow(e.title) })),
    );
    const shows: SimilarShow[] = paired
      .filter((p): p is { e: XyzChartEntry; show: CatalogShow } => p.show !== null)
      .map(({ e, show }) => ({ ...show, why: showWhy(e) }));
    return json({ tab, shows, episodes: [], degraded: shows.length === 0 });
  }

  const entries = tab === "episodes" ? await xyzrankHotEpisodes() : await xyzrankNewEpisodes();
  if (!entries || entries.length === 0) {
    return json({ tab, shows: [], episodes: [], degraded: true });
  }
  const episodes = await Promise.all(entries.slice(0, limit).map((e) => resolveEpisode(e)));
  return json({ tab, shows: [], episodes, degraded: false });
}

function json(body: XyzrankBoardResponse) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" },
  });
}

function compact(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}w`; // 万
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return String(n);
}

function showWhy(e: XyzChartEntry): string {
  const bits: string[] = [`#${e.rank} on 小宇宙`];
  if (e.subscribers != null) bits.push(`${compact(e.subscribers)} subscribers`);
  else if (e.comments != null) bits.push(`${compact(e.comments)} comments`);
  else if (e.plays != null) bits.push(`${compact(e.plays)} plays`);
  return bits.join(" · ");
}

function episodeWhy(e: XyzEpisodeEntry): string {
  const bits: string[] = [`#${e.rank}`];
  if (e.plays != null) bits.push(`${compact(e.plays)} plays`);
  if (e.comments != null) bits.push(`${compact(e.comments)} comments`);
  return `${bits.join(" · ")} on 小宇宙`;
}

/** Resolve a xyzrank title to a real CN-storefront catalog show, if it exists. */
async function resolveShow(title: string): Promise<CatalogShow | null> {
  const results = await itunesSearch(title, "cn");
  if (!results || results.length === 0) return null;
  const key = normalizeForMatch(title);
  return results.find((s) => normalizeForMatch(s.title) === key) ?? results[0];
}

/** Resolve an episode's parent show too — episodes carry no feed of their own. */
async function resolveEpisode(e: XyzEpisodeEntry): Promise<XyzrankEpisodeItem> {
  const show = e.showTitle ? await resolveShow(e.showTitle) : null;
  return {
    id: stableFeedId(`${e.showTitle ?? ""}|${e.title}`),
    title: e.title,
    showTitle: e.showTitle,
    showId: show?.id,
    feedUrl: show?.feedUrl,
    appleUrl: show?.appleUrl,
    coverUrl: show?.coverUrl,
    platformLinks: show?.platformLinks,
    url: e.url,
    why: episodeWhy(e),
  };
}
