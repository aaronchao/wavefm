import { NextResponse } from "next/server";
import { rankEpisodes, type EpisodeInput } from "@/src/core/recommend";
import { lookupShow } from "@/src/data/catalog/lookup";
import { episodesFromRss, type RssEpisode } from "@/src/data/catalog/rss";
import type { EpisodesRankedResponse } from "@/src/data/catalog/types";

/**
 * Proxy: a show's episodes ranked top to bottom. Free APIs expose no
 * per-episode listen counts, so ranking is discussion-first where that
 * signal exists, else recency/substantive-duration — each row labels its
 * honest basis. Audio URLs come from the RSS enclosures so the discovery
 * page can play a random middle clip of the #1 episode. Best-effort:
 * unreachable feed -> { episodes: [], degraded: true }, never a 5xx.
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const show = await lookupShow(id);
  const eps: RssEpisode[] = show?.feedUrl
    ? await episodesFromRss(show.feedUrl, 25)
    : [];

  // stable id per episode (RSS items lack ids); keep the source row to
  // recover audio/duration/date after the pure ranking
  const byId = new Map<string, RssEpisode>();
  const inputs: EpisodeInput[] = eps.map((e, i) => {
    const epId = e.audioUrl || `ep-${i}`;
    byId.set(epId, e);
    return {
      id: epId,
      title: e.title,
      publishedAt: e.publishedAt,
      durationSec: e.durationSec,
    };
  });

  const ranked = rankEpisodes(inputs, { limit: 10 });
  const response: EpisodesRankedResponse = {
    episodes: ranked.map((r) => {
      const src = byId.get(r.episode.id);
      return {
        id: r.episode.id,
        title: r.episode.title,
        audioUrl: src?.audioUrl,
        durationSec: src?.durationSec,
        publishedAt: src?.publishedAt,
        basis: r.basis,
        why: r.why,
      };
    }),
    degraded: eps.length === 0,
  };

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}
