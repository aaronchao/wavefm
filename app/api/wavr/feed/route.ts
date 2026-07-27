import { NextResponse } from "next/server";
import { buildDeck, interestProfile, parseDiscussion, type WavrCandidate } from "@/src/core/wavr";
import type { DiscussedChartsResponse, EpisodesRankedResponse, SimilarShow } from "@/src/data/catalog/types";
import type { WavrFeedResponse } from "@/src/data/wavr/types";

/**
 * Proxy: the Wavr deck. Source ladder per docs/wavr-route-design.md §8.3 —
 * `/api/catalog/charts/discussed` (real community evidence) narrowed to
 * shows with evidence, then `/api/catalog/episodes-ranked` per matched show
 * for a playable episode. Each rung is best-effort; the whole ladder failing
 * yields `degraded: true`, never a thrown error.
 *
 * `tags` is the ONLY signal that crosses into the request — the user's own
 * engagement history never leaves the browser (§8.1's CF guard), so the
 * profile built here is declared-interest-only. The client is free to send
 * its already-engagement-weighted top tags; the server just treats them as
 * a flat set, which keeps this route ignorant of any individual user's
 * behaviour.
 */

const MAX_SHOWS_PER_PAGE = 10;
const MAX_EVIDENCE_PER_SHOW = 3;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tags = (url.searchParams.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const limitParam = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 24) : 12;
  const exclude = new Set(
    (url.searchParams.get("exclude") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  );
  const offset = Math.max(0, Number(url.searchParams.get("cursor")) || 0);

  const discussed = await fetchJson<DiscussedChartsResponse>(
    new URL("/api/catalog/charts/discussed?limit=24", url.origin),
  );
  const withEvidence = (discussed?.shows ?? []).filter(
    (s) => s.evidence && s.evidence.length > 0,
  );

  if (withEvidence.length === 0) {
    return json({ cards: [], cursor: null, degraded: true });
  }

  const page = withEvidence.slice(offset, offset + MAX_SHOWS_PER_PAGE);
  const nextOffset = offset + page.length;
  const cursor = nextOffset < withEvidence.length ? String(nextOffset) : null;

  const candidates = (
    await Promise.all(page.map((show) => candidateFor(show, url.origin)))
  ).filter((c): c is WavrCandidate => c !== null && !exclude.has(`${c.showId}:${c.episodeId}`));

  const profile = interestProfile(tags, [], {});
  const cards = buildDeck(candidates, profile, { limit });

  return json({ cards, cursor, degraded: cards.length === 0 && candidates.length === 0 });
}

async function candidateFor(show: SimilarShow, origin: string): Promise<WavrCandidate | null> {
  const evidence = (show.evidence ?? []).slice(0, MAX_EVIDENCE_PER_SHOW);
  if (evidence.length === 0) return null;

  const ranked = await fetchJson<EpisodesRankedResponse>(
    new URL(`/api/catalog/episodes-ranked?id=${encodeURIComponent(show.id)}`, origin),
  );
  const episode = ranked?.episodes.find((e) => e.audioUrl) ?? ranked?.episodes[0];
  if (!episode) return null;

  return {
    episodeId: episode.id,
    showId: show.id,
    title: episode.title,
    showTitle: show.title,
    coverUrl: show.coverUrl,
    audioUrl: episode.audioUrl,
    durationSec: episode.durationSec,
    appleUrl: show.appleUrl,
    publishedAt: episode.publishedAt,
    discussions: evidence.map((e) => parseDiscussion(e, show.categories)),
  };
}

async function fetchJson<T>(url: URL): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null; // best-effort rung — a network failure just skips it
  }
}

function json(body: WavrFeedResponse) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400" },
  });
}
