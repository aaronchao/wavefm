import { NextResponse } from "next/server";
import { youtubeChannelUrl } from "@/src/data/buzz/youtube";

// Proxy: a real YouTube channel link for a title (REFINEMENTS.md #6),
// standing in for YouTube Music's dead-end search. Unconfigured key / no
// match / any failure -> { url: null }, never a blocking error.
export async function GET(request: Request) {
  const title = new URL(request.url).searchParams.get("title")?.trim() ?? "";
  if (!title) {
    return NextResponse.json({ url: null }, { status: 400 });
  }

  const url = await youtubeChannelUrl(title);

  return NextResponse.json(
    { url },
    { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400" } },
  );
}
