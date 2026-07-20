import { NextResponse } from "next/server";
import { itunesEpisodeSearch, itunesSearch, piSearch } from "@/src/data/catalog/server";
import type { CatalogSearchResponse } from "@/src/data/catalog/types";

// Proxy: iTunes Search (primary) -> Podcast Index (secondary, optional key).
// Returns matching shows AND episodes (one-click "Later" queues an episode).
// Upstream failures degrade to an empty result — never a blocking error.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ error: "missing q" }, { status: 400 });
  }

  const [itunes, eps] = await Promise.all([itunesSearch(q), itunesEpisodeSearch(q)]);
  const episodes = eps ?? [];

  if (itunes && itunes.length > 0) {
    return json({ shows: itunes, episodes, degraded: false });
  }

  // iTunes failed or found nothing — Podcast Index has broader coverage.
  const pi = await piSearch(q);
  if (pi) {
    return json({ shows: pi, episodes, degraded: false });
  }

  return json({ shows: itunes ?? [], episodes, degraded: itunes === null });
}

function json(body: CatalogSearchResponse) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
