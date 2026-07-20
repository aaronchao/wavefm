import { NextResponse } from "next/server";
import { lookupShow } from "@/src/data/catalog/lookup";
import { episodesFromRss } from "@/src/data/catalog/rss";
import type { PreviewResponse } from "@/src/data/catalog/types";

/**
 * Proxy: playable episodes of a show for 30-second preview clips —
 * newest ~10 items of the show's RSS feed with their enclosure URLs.
 * Only metadata flows through here; the audio itself streams from the
 * podcast's public CDN straight to the browser's <audio> element
 * (proxying media would burn the free hosting tier for nothing).
 * Anything missing -> { episodes: [] }, never an error.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id")?.trim() ?? "";
  // feed-only shows (OPML imports, `rss-` ids) aren't in any catalog —
  // the client sends their feed URL along so previews still work
  const feedUrlParam = params.get("feedUrl")?.trim();
  if (!id && !feedUrlParam) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const show = id && !id.startsWith("rss-") ? await lookupShow(id) : null;
  const feedUrl = show?.feedUrl ?? feedUrlParam;
  const episodes = feedUrl ? await episodesFromRss(feedUrl, 10) : [];

  const response: PreviewResponse = {
    episodes: episodes.map((e) => ({
      title: e.title,
      audioUrl: e.audioUrl,
      durationSec: e.durationSec,
    })),
  };

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}
