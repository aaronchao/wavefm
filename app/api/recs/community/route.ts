import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/src/data/mining/admin";
import type {
  CatalogShow,
  CommunityRecsResponse,
  EvidenceItem,
  SimilarShow,
} from "@/src/data/catalog/types";

/**
 * Serve community-mined recommendations for a seed show — read straight from
 * the precomputed `rec_edges` table, so this is a single indexed lookup (~10ms,
 * no external calls). Returns `degraded: true` when the pipeline hasn't produced
 * edges for this seed yet (or secrets aren't set); the caller then falls back to
 * the live discussion path, so the surface never renders worse than today.
 */

type EdgeRow = {
  rec_show_id: string;
  score: number;
  author_count: number;
  sentiment_avg: number;
  evidence: unknown;
};
type ShowRow = {
  id: string;
  itunes_id: string | null;
  title: string;
  author: string | null;
  description: string | null;
  cover_url: string | null;
  feed_url: string | null;
  categories: string[] | null;
  platform_links: { apple?: string } | null;
};

const EMPTY: CommunityRecsResponse = { shows: [], degraded: true };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const seed = url.searchParams.get("seed");
  const limitParam = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 24) : 12;
  if (!seed) return NextResponse.json(EMPTY);

  const admin = getAdminSupabase();
  if (!admin) return NextResponse.json(EMPTY);

  const { data: edgeData, error } = await admin
    .from("rec_edges")
    .select("rec_show_id, score, author_count, sentiment_avg, evidence")
    .eq("seed_show_id", seed)
    .order("score", { ascending: false })
    .limit(limit);
  if (error || !edgeData || edgeData.length === 0) return NextResponse.json(EMPTY);

  const edges = edgeData as EdgeRow[];
  const { data: showData } = await admin
    .from("shows")
    .select("*")
    .in("id", edges.map((e) => e.rec_show_id));
  const showById = new Map((showData as ShowRow[] | null ?? []).map((r) => [r.id, r]));

  const shows: SimilarShow[] = [];
  for (const e of edges) {
    const row = showById.get(e.rec_show_id);
    if (!row) continue; // rec not in our catalog cache — skip rather than guess
    shows.push({
      ...mapShow(row),
      why: communityWhy(e),
      evidence: asEvidence(e.evidence),
    });
  }

  const response: CommunityRecsResponse = { shows, degraded: false };
  return NextResponse.json(response, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}

function mapShow(r: ShowRow): CatalogShow {
  return {
    id: r.id,
    source: r.itunes_id ? "itunes" : "podcastindex",
    title: r.title,
    author: r.author ?? "",
    description: r.description ?? undefined,
    coverUrl: r.cover_url ?? undefined,
    feedUrl: r.feed_url ?? undefined,
    appleUrl: r.platform_links?.apple,
    categories: r.categories ?? [],
  };
}

function communityWhy(e: EdgeRow): string {
  const source = asEvidence(e.evidence)[0]?.source;
  const who = e.author_count > 1 ? `${e.author_count} listeners` : "a listener";
  return source ? `${who} on ${source} recommend this` : `Recommended by ${who} in community threads`;
}

function asEvidence(value: unknown): EvidenceItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === "object")
    .map((v) => ({
      source: String(v.source ?? ""),
      text: String(v.text ?? ""),
      url: typeof v.url === "string" ? v.url : undefined,
    }))
    .filter((e) => e.source && e.text);
}
