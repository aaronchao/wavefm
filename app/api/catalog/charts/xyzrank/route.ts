import { NextResponse } from "next/server";
import { normalizeForMatch } from "@/src/data/buzz/match";
import {
  xyzrankChart,
  xyzrankHotEpisodes,
  xyzrankNewEpisodes,
  xyzrankNewPodcasts,
  xyzrankPodcastById,
  type XyzChartEntry,
  type XyzEpisodeEntry,
} from "@/src/data/buzz/xyzrank";
import { itunesSearch } from "@/src/data/catalog/server";
import type {
  XyzrankBoardResponse,
  XyzrankEpisodeItem,
  XyzrankShowItem,
  XyzrankTab,
} from "@/src/data/catalog/types";

/**
 * Proxy: xyzrank.com's own four boards, verbatim — see src/data/buzz/xyzrank.ts
 * for the endpoint mapping and confirmed schema. Unlike the blended charts
 * elsewhere in /api/catalog/charts, this keeps xyzrank's own rank order and
 * uses its own direct links (apple/rss/小宇宙, submitted by each show's own
 * creator) rather than re-scoring or fuzzy-matching — no risk of resolving
 * the wrong show, and Save/OpenInLinks work immediately since a real
 * iTunes id, feed, and cover all come straight from the source.
 */
const TABS: XyzrankTab[] = ["podcasts", "new-podcasts", "episodes", "new-episodes"];

export async function GET(request: Request) {
  const tabParam = new URL(request.url).searchParams.get("tab");
  const tab: XyzrankTab = (TABS as string[]).includes(tabParam ?? "")
    ? (tabParam as XyzrankTab)
    : "podcasts";

  if (tab === "podcasts" || tab === "new-podcasts") {
    const entries = tab === "podcasts" ? await xyzrankChart() : await xyzrankNewPodcasts();
    if (!entries || entries.length === 0) {
      return json({ tab, shows: [], episodes: [], degraded: true });
    }
    return json({ tab, shows: entries.map(toShowItem), episodes: [], degraded: false });
  }

  const entries = tab === "episodes" ? await xyzrankHotEpisodes() : await xyzrankNewEpisodes();
  if (!entries || entries.length === 0) {
    return json({ tab, shows: [], episodes: [], degraded: true });
  }
  const podcastById = await xyzrankPodcastById();
  const episodes = await Promise.all(entries.map((e) => toEpisodeItem(e, podcastById)));
  return json({ tab, shows: [], episodes, degraded: false });
}

function json(body: XyzrankBoardResponse) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" },
  });
}

/** The numeric iTunes id embedded in an Apple Podcasts URL, e.g. `.../id1582119137`. */
function appleId(appleUrl: string | undefined): string | undefined {
  return appleUrl?.match(/\/id(\d+)/)?.[1];
}

function toShowItem(e: XyzChartEntry): XyzrankShowItem {
  const id = appleId(e.links.apple);
  return {
    // Falls back to xyzrank's own id on the rare entry with no Apple link
    // (none seen live, but the schema doesn't guarantee it) — Save/display
    // still work; only the show detail page and ranked episodes need the
    // real iTunes id, which is absent either way in that case.
    id: id ?? `xyz-${e.id}`,
    rank: e.rank,
    title: e.title,
    author: e.author,
    category: e.category,
    coverUrl: e.coverUrl,
    feedUrl: e.links.rss,
    appleUrl: e.links.apple,
    xiaoyuzhouUrl: e.links.xiaoyuzhou,
    episodeCount: e.episodeCount,
    lastReleaseDaysAgo: e.lastReleaseDaysAgo,
    avgPlays: e.avgPlays,
    avgComments: e.avgComments,
    avgDurationSec: e.avgDurationSec,
  };
}

/** Resolve a title to a real CN-storefront catalog show — fallback only, for the
 *  rare episode whose parent show isn't on either podcast board to join against. */
async function resolveShowByTitle(
  title: string,
): Promise<{ id?: string; feedUrl?: string; appleUrl?: string; coverUrl?: string } | null> {
  const results = await itunesSearch(title, "cn");
  if (!results || results.length === 0) return null;
  const key = normalizeForMatch(title);
  const match = results.find((s) => normalizeForMatch(s.title) === key) ?? results[0];
  return { id: match.id, feedUrl: match.feedUrl, appleUrl: match.appleUrl, coverUrl: match.coverUrl };
}

async function toEpisodeItem(
  e: XyzEpisodeEntry,
  podcastById: Map<string, XyzChartEntry>,
): Promise<XyzrankEpisodeItem> {
  const parent = e.podcastId ? podcastById.get(e.podcastId) : undefined;
  const fallback = !parent && e.showTitle ? await resolveShowByTitle(e.showTitle) : null;
  const id = appleId(parent?.links.apple) ?? fallback?.id;
  return {
    id: `${e.podcastId ?? e.showTitle ?? ""}|${e.title}`,
    rank: e.rank,
    title: e.title,
    showTitle: e.showTitle,
    showId: id,
    feedUrl: parent?.links.rss ?? fallback?.feedUrl,
    appleUrl: parent?.links.apple ?? fallback?.appleUrl,
    coverUrl: e.coverUrl ?? parent?.coverUrl ?? fallback?.coverUrl,
    url: e.url,
    plays: e.plays,
    comments: e.comments,
    subscribers: e.subscribers,
    durationSec: e.durationSec,
    publishedAt: e.publishedAt,
  };
}
