import { NextResponse } from "next/server";
import { buildDeck, interestProfile, parseDiscussion, type WavrCandidate, type WavrCard } from "@/src/core/wavr";
import type { EdgeEvidence } from "@/src/core/mining/types";
import { dcardDiscussion } from "@/src/data/buzz/dcard";
import { doubanGroupDiscussion, lihkgDiscussion, pttDiscussion } from "@/src/data/buzz/forums";
import { redditDiscussion } from "@/src/data/buzz/reddit";
import { v2exDiscussion } from "@/src/data/buzz/v2ex";
import { itunesEpisodeSearch, itunesSearch } from "@/src/data/catalog/server";
import type {
  CatalogEpisode,
  CatalogShow,
  DiscussedChartsResponse,
  EpisodesRankedResponse,
} from "@/src/data/catalog/types";
import { getSupabase } from "@/src/data/supabase/client";
import type { WavrFeedResponse } from "@/src/data/wavr/types";

/**
 * Proxy: the Wavr deck. Source ladder per docs/wavr-route-design.md §8.3,
 * widened after the initial build turned out too narrow in practice —
 * `rec_edges.evidence` (the offline community-mining pipeline's precomputed,
 * already-real quotes) FIRST, then a live, TAG-DRIVEN search: candidate shows
 * come from an iTunes search on the user's own declared interests (not a
 * fixed pool), each checked for real discussion evidence. Only after both of
 * those does it fall back to the generic `/api/catalog/charts/discussed`
 * board for breadth. `/api/catalog/episodes-ranked` resolves a playable
 * episode per matched show. Each rung is best-effort; the whole ladder
 * failing yields `degraded: true`, never a thrown error.
 *
 * When evidence-backed rungs still come up short (the community-mining pool
 * is small, and live discussion sources — Reddit/Douban/etc. — are
 * frequently rate-limited or unconfigured in this deployment), the deck
 * tops itself up with a plain, evidence-free episode search on the user's
 * own tags — the same method "Wavr Mini" (Discovery's For-You deck) already
 * uses successfully via `useInterestEpisodes`. These cards say "Because you
 * follow X", never a fabricated quote, and always rank behind anything with
 * real community evidence.
 *
 * `tags` is the ONLY signal that crosses into the request — the user's own
 * engagement history never leaves the browser (§8.1's CF guard), so the
 * profile built here is declared-interest-only. The client is free to send
 * its already-engagement-weighted top tags; the server just treats them as
 * a flat set, which keeps this route ignorant of any individual user's
 * behaviour. Both tag-driven rungs use those same tags as catalog search
 * terms — still nobody else's data, just the user's own declared interests
 * reaching further than the precomputed pool.
 */

const MAX_SHOWS_PER_PAGE = 18;
const MAX_EVIDENCE_PER_SHOW = 3;
const REC_EDGES_LIMIT = 300;

type EdgeRow = { rec_show_id: string; score: number; evidence: unknown };
type ShowRow = {
  id: string;
  title: string;
  cover_url: string | null;
  categories: string[] | null;
  platform_links: { apple?: string } | null;
};

/** A show + the evidence quotes earning it a slot, from whichever rung supplied it. */
type Pooled = { show: CatalogShow; evidence: EdgeEvidence[] };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tags = (url.searchParams.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const limitParam = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 30) : 12;
  const exclude = new Set(
    (url.searchParams.get("exclude") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  );
  const offset = Math.max(0, Number(url.searchParams.get("cursor")) || 0);

  const byId = new Map<string, Pooled>();
  for (const p of await fromRecEdges()) if (!byId.has(p.show.id)) byId.set(p.show.id, p);
  for (const p of await fromInterestSearch(tags)) if (!byId.has(p.show.id)) byId.set(p.show.id, p);
  for (const p of await fromDiscussedCharts(url.origin)) if (!byId.has(p.show.id)) byId.set(p.show.id, p);

  const pool = [...byId.values()];
  const page = pool.slice(offset, offset + MAX_SHOWS_PER_PAGE);
  const nextOffset = offset + page.length;
  const cursor = nextOffset < pool.length ? String(nextOffset) : null;

  const candidates = (
    await Promise.all(page.map((p) => candidateFor(p, url.origin)))
  ).filter((c): c is WavrCandidate => c !== null && !exclude.has(`${c.showId}:${c.episodeId}`));

  const profile = interestProfile(tags, [], {});
  let cards = buildDeck(candidates, profile, { limit });

  // Evidence-backed matches always lead; top up the rest from a plain tag
  // search when the pool is thin or came up empty for this page, so the
  // deck still has real, playable content instead of an honest-but-empty
  // screen. Excludes anything already decided or already on this page.
  if (cards.length < limit) {
    const already = new Set(cards.map((c) => c.id));
    const direct = await fromInterestEpisodeSearch(tags, exclude, already);
    cards = [...cards, ...direct].slice(0, limit);
  }

  return json({ cards, cursor, degraded: cards.length === 0 && pool.length === 0 });
}

/** Rung 1: the offline community-mining pipeline's precomputed edges (rec_edges is world-readable). */
async function fromRecEdges(): Promise<Pooled[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data: edgeData, error } = await sb
      .from("rec_edges")
      .select("rec_show_id, score, evidence")
      .order("score", { ascending: false })
      .limit(REC_EDGES_LIMIT);
    if (error || !edgeData) return [];
    const edges = edgeData as EdgeRow[];

    // Merge evidence across every edge that recommends the same show
    // (different seeds often surface the same popular rec), best score first.
    const evidenceByShow = new Map<string, EdgeEvidence[]>();
    for (const e of edges) {
      const list = evidenceByShow.get(e.rec_show_id) ?? [];
      list.push(...asEvidence(e.evidence));
      evidenceByShow.set(e.rec_show_id, list);
    }
    const showIds = [...evidenceByShow.keys()];
    if (showIds.length === 0) return [];

    const { data: showData } = await sb.from("shows").select("*").in("id", showIds);
    const showById = new Map((showData as ShowRow[] | null ?? []).map((r) => [r.id, r]));

    const out: Pooled[] = [];
    for (const id of showIds) {
      const row = showById.get(id);
      if (!row) continue; // recommended show not in our catalog cache — skip rather than guess
      out.push({ show: mapShow(row), evidence: evidenceByShow.get(id)!.slice(0, MAX_EVIDENCE_PER_SHOW) });
    }
    return out;
  } catch {
    return []; // best-effort rung — a DB hiccup just skips it
  }
}

/** How many of the user's own tags become search terms (bounded for latency/cost). */
const MAX_SEARCH_TAGS = 4;
/** How many candidate shows per tag get a discussion check. */
const MAX_CANDIDATES_PER_TAG = 10;

/**
 * Rung 2: search the general podcast catalog with the user's OWN declared
 * interests as terms, then check each candidate for real discussion evidence
 * — the same per-show discussion functions the discussed-chart route uses,
 * just aimed at shows relevant to this user instead of a fixed topic pool.
 * This is what actually gives an unusual or non-English interest a chance:
 * the precomputed rec_edges pool and the generic discussed board are both
 * fixed-size snapshots that skew toward whatever got mined/searched before.
 */
async function fromInterestSearch(tags: string[]): Promise<Pooled[]> {
  if (tags.length === 0) return [];
  const terms = tags.slice(0, MAX_SEARCH_TAGS);

  const resultLists = await Promise.all(
    terms.flatMap((term) => [safeSearch(term, "cn"), safeSearch(term, "us")]),
  );
  const showById = new Map<string, CatalogShow>();
  for (const list of resultLists) {
    for (const s of list.slice(0, MAX_CANDIDATES_PER_TAG)) {
      if (!showById.has(s.id)) showById.set(s.id, s);
    }
  }
  const candidates = [...showById.values()];
  if (candidates.length === 0) return [];

  const withEvidence = await Promise.all(
    candidates.map(async (show) => {
      const [reddit, douban, dcard, ptt, lihkg, v2ex] = await Promise.all([
        redditDiscussion(show.title),
        doubanGroupDiscussion(show.title),
        dcardDiscussion(show.title),
        pttDiscussion(show.title),
        lihkgDiscussion(show.title),
        v2exDiscussion(show.title),
      ]);
      const evidence = [
        ...(reddit?.evidence ?? []),
        ...(douban?.evidence ?? []),
        ...(dcard?.evidence ?? []),
        ...(ptt?.evidence ?? []),
        ...(lihkg?.evidence ?? []),
        ...(v2ex?.evidence ?? []),
      ].slice(0, MAX_EVIDENCE_PER_SHOW);
      return evidence.length > 0 ? { show, evidence } : null;
    }),
  );
  return withEvidence.filter((p): p is Pooled => p !== null);
}

async function safeSearch(term: string, country: string): Promise<CatalogShow[]> {
  try {
    return (await itunesSearch(term, country)) ?? [];
  } catch {
    return []; // best-effort — a bad search term or network hiccup just skips it
  }
}

/** Fixed score for tag-searched (no discussion evidence) cards — always
 *  below anything that cleared MIN_MATCH via real community discussion, so
 *  evidence-backed cards lead the deck whenever they exist. */
const DIRECT_MATCH_SCORE = 0.05;
/** How many episodes per tag term the direct-search fallback pulls. */
const DIRECT_PER_TERM = 10;

/**
 * Top-up rung: a plain episode search on the user's own tags, no discussion
 * evidence required — the same method "Wavr Mini" (Discovery's For-You deck,
 * `useInterestEpisodes`) already uses. Only reached when the evidence-backed
 * rungs above didn't fill the deck; every card here says "Because you
 * follow X", never a fabricated community quote.
 */
async function fromInterestEpisodeSearch(
  tags: string[],
  exclude: Set<string>,
  already: Set<string>,
): Promise<WavrCard[]> {
  const terms = [...new Set(tags.map((t) => t.trim()).filter(Boolean))].slice(0, MAX_SEARCH_TAGS);
  if (terms.length === 0) return [];

  const byTerm = await Promise.all(
    terms.map(async (term) => {
      let episodes: CatalogEpisode[] = [];
      try {
        episodes = (await itunesEpisodeSearch(term)) ?? [];
      } catch {
        episodes = [];
      }
      return {
        term,
        episodes: episodes
          .filter((e) => e.audioUrl)
          .sort((a, b) => tsOf(b) - tsOf(a))
          .slice(0, DIRECT_PER_TERM),
      };
    }),
  );

  // Interleave one-per-term (round-robin) so no single interest dominates.
  const seen = new Set<string>();
  const cards: WavrCard[] = [];
  const depth = Math.max(0, ...byTerm.map((t) => t.episodes.length));
  for (let i = 0; i < depth; i++) {
    for (const { term, episodes } of byTerm) {
      const ep = episodes[i];
      if (!ep) continue;
      const showId = ep.showId ?? ep.id;
      const id = `${showId}:${ep.id}`;
      if (seen.has(id) || exclude.has(id) || already.has(id)) continue;
      seen.add(id);
      cards.push({
        id,
        episodeId: ep.id,
        showId,
        title: ep.title,
        showTitle: ep.showTitle ?? "",
        coverUrl: ep.coverUrl,
        audioUrl: ep.audioUrl,
        durationSec: ep.durationSec,
        appleUrl: ep.appleUrl,
        publishedAt: ep.publishedAt,
        matchedTags: [term],
        why: `Because you follow ${term}`,
        score: DIRECT_MATCH_SCORE,
      });
    }
  }
  return cards;
}

function tsOf(ep: CatalogEpisode): number {
  return ep.publishedAt ? Date.parse(ep.publishedAt) || 0 : 0;
}

/** Rung 3: live discussion evidence — best-effort, often thin from Vercel's IPs. */
async function fromDiscussedCharts(origin: string): Promise<Pooled[]> {
  const discussed = await fetchJson<DiscussedChartsResponse>(
    new URL("/api/catalog/charts/discussed?limit=24", origin),
  );
  const out: Pooled[] = [];
  for (const s of discussed?.shows ?? []) {
    if (!s.evidence || s.evidence.length === 0) continue;
    out.push({ show: s, evidence: s.evidence.slice(0, MAX_EVIDENCE_PER_SHOW) });
  }
  return out;
}

function mapShow(r: ShowRow): CatalogShow {
  return {
    id: r.id,
    source: "itunes",
    title: r.title,
    author: "",
    coverUrl: r.cover_url ?? undefined,
    appleUrl: r.platform_links?.apple,
    categories: r.categories ?? [],
  };
}

function asEvidence(value: unknown): EdgeEvidence[] {
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

async function candidateFor(pooled: Pooled, origin: string): Promise<WavrCandidate | null> {
  const { show, evidence } = pooled;
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
