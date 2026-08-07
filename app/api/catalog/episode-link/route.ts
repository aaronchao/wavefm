import { NextResponse } from "next/server";
import { matchAppleEpisode } from "@/src/core/appleEpisode";
import { itunesId } from "@/src/core/links";
import { itunesShowEpisodes } from "@/src/data/catalog/server";

/**
 * Proxy: Apple Podcasts deep link for a SPECIFIC episode, so "open in Apple"
 * lands on the episode rather than the show. Only needed for episodes that
 * came from RSS/Podcast Index — iTunes-sourced ones already carry their own
 * `appleUrl` (see mapItunesEpisode).
 *
 * Matching is exact on the audio enclosure URL; see src/core/appleEpisode.ts
 * for why an ambiguous title never resolves. No match / any failure ->
 * { url: null }, never a blocking error — the caller falls back to the
 * show-level link.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const showId = params.get("showId")?.trim() ?? "";
  const title = params.get("title")?.trim() ?? "";
  const audioUrl = params.get("audioUrl")?.trim() || undefined;

  // Only numeric iTunes collection ids can be looked up; `pi-`/`rss-` ids
  // have no Apple equivalent to search against.
  const collectionId = itunesId(showId);
  if (!collectionId || !title) {
    return NextResponse.json({ url: null }, { status: 400 });
  }

  const candidates = await itunesShowEpisodes(collectionId);
  const url = matchAppleEpisode(candidates, { audioUrl, title });

  return NextResponse.json(
    { url },
    { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400" } },
  );
}
