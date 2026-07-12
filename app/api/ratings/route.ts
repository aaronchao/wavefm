import { NextResponse } from "next/server";
import {
  ALL_SOURCES,
  fetchRatings,
  type RatingResult,
  type RatingSource,
} from "@/src/data/ratings/provider";
import { getServerSupabase } from "@/src/data/supabase/server";
import type { RatingsCacheRow } from "@/src/data/supabase/types";

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

// GET /api/ratings?showId=..&title=..[&sources=douban,xiaoyuzhou]
// Serve cache first (7d TTL), refresh lazily, never error to the UI.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const showId = params.get("showId")?.trim() ?? "";
  const title = params.get("title")?.trim() ?? "";
  const sources = (params.get("sources")?.split(",") ?? ALL_SOURCES).filter(
    (s): s is RatingSource => (ALL_SOURCES as string[]).includes(s),
  );
  if (!showId || !title) {
    return NextResponse.json({ error: "missing showId or title" }, { status: 400 });
  }

  const cached = await readCache(showId, sources);
  const fresh = sources.filter((s) => cached[s] === undefined);

  let fetched: RatingResult[] = [];
  if (fresh.length > 0) {
    fetched = await fetchRatings(title, fresh);
    void writeCache(showId, fetched);
  }

  const ratings: RatingResult[] = [
    ...sources
      .filter((s) => cached[s] !== undefined)
      .map((s) => ({ source: s, rating: cached[s]! })),
    ...fetched,
  ];
  return NextResponse.json(
    { ratings },
    { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
  );
}

/** source -> rating (null = known-missing); undefined = not cached/stale. */
async function readCache(
  showId: string,
  sources: RatingSource[],
): Promise<Partial<Record<RatingSource, number | null>>> {
  const sb = getServerSupabase();
  if (!sb) return {};
  try {
    const { data } = await sb
      .from("ratings_cache")
      .select("source, rating, fetched_at")
      .eq("show_id", showId)
      .in("source", sources);
    const out: Partial<Record<RatingSource, number | null>> = {};
    for (const row of (data ?? []) as Pick<RatingsCacheRow, "source" | "rating" | "fetched_at">[]) {
      if (Date.now() - Date.parse(row.fetched_at) < TTL_MS) {
        out[row.source as RatingSource] = row.rating;
      }
    }
    return out;
  } catch {
    return {};
  }
}

async function writeCache(showId: string, results: RatingResult[]): Promise<void> {
  const sb = getServerSupabase();
  if (!sb) return;
  try {
    await sb.from("ratings_cache").upsert(
      results.map((r) => ({
        show_id: showId,
        source: r.source,
        rating: r.rating,
        fetched_at: new Date().toISOString(),
      })),
    );
  } catch {
    // cache write blocked (no service key) — fine, it's only a cache
  }
}
