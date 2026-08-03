import { NextResponse } from "next/server";
import { youtubeChannelUrl, youtubeEpisodeUrl } from "@/src/data/buzz/youtube";

/**
 * Proxy: a real, listenable YouTube link for a title (REFINEMENTS.md #6),
 * standing in for YouTube Music's dead-end search. With an `episode` query
 * param, resolves that specific episode's own video (autoplays on open) and
 * only falls back to the show's channel when no matching video is found;
 * without it, resolves the channel directly (show-level call sites have no
 * specific episode to match). Unconfigured key / no match / any failure ->
 * { url: null }, never a blocking error.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const title = params.get("title")?.trim() ?? "";
  const episode = params.get("episode")?.trim() || undefined;
  if (!title) {
    return NextResponse.json({ url: null }, { status: 400 });
  }

  const url = episode ? await youtubeEpisodeUrl(episode, title) : await youtubeChannelUrl(title);

  return NextResponse.json(
    { url },
    { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400" } },
  );
}
