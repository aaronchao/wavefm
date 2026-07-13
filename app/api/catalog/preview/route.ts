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
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const show = await lookupShow(id);
  const episodes = show?.feedUrl ? await episodesFromRss(show.feedUrl, 10) : [];

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
