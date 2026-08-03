import { NextResponse } from "next/server";
import { spotifyShowUrl } from "@/src/data/catalog/spotify";

// Proxy: real Spotify show URL by title (REFINEMENTS.md #5). Unconfigured
// keys / no match / any failure -> { url: null }, never a blocking error.
export async function GET(request: Request) {
  const title = new URL(request.url).searchParams.get("title")?.trim() ?? "";
  if (!title) {
    return NextResponse.json({ url: null }, { status: 400 });
  }

  const url = await spotifyShowUrl(title);

  return NextResponse.json(
    { url },
    { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400" } },
  );
}
