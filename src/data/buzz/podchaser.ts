import type { BuzzInput } from "@/src/core/recommend";
import type { EvidenceItem } from "@/src/data/catalog/types";
import { getMonthlyUsage, incrementMonthlyUsage } from "@/src/data/repos/usageCountersRepo";
import { titlesMatch } from "./match";

/**
 * Podchaser — critic reviews + user-curated genre lists ("best philosophy
 * podcasts") for English-language podcasts (REFINEMENTS.md #9). Unlike the
 * mention-count signals (Reddit, HN, forums), this is real curatorial text —
 * strengthens the niche-cluster "why" copy specifically for EN shows.
 * Server-side only; gated behind PODCHASER_CLIENT_ID/PODCHASER_CLIENT_SECRET
 * (OAuth2 client-credentials grant, same shape as `catalog/spotify.ts`).
 *
 * ⚠️ UNVERIFIED AGAINST THE LIVE SCHEMA — no Podchaser credentials were
 * available in this environment, so nothing below was exercised against a
 * real response. The token endpoint path and, especially, the GraphQL
 * query/field names (`podcasts`, `searchTerm`, `rating`, `ratingCount`,
 * `reviews`, `lists`, `webUrl`) are a best-effort reconstruction from
 * Podchaser's publicly documented GraphQL API shape, NOT confirmed live.
 * Same situation as `src/data/mining/harvest/zhihu.ts` — read that file's
 * header for the precedent. Before relying on this in production: request a
 * free key at developers.podchaser.com, then run a GraphQL introspection
 * query (`{ __schema { types { name fields { name } } } }`) against
 * https://api.podchaser.com/graphql and fix any field/path that drifted.
 * Until PODCHASER_CLIENT_ID/SECRET are set this is a clean no-op — no
 * token fetch, no query, ever (NO_HARD_DEPS_ON_EXTERNAL_APIS).
 */

const TOKEN_URL = "https://api.podchaser.com/token";
const GRAPHQL_URL = "https://api.podchaser.com/graphql";
const REVALIDATE_SECONDS = 7 * 24 * 60 * 60; // critic reviews/lists move slowly
const PROVIDER = "podchaser";
// Guess — Podchaser's actual free-tier request limit isn't confirmed (no
// live credentials to read quota headers/docs against). Conservative
// default in the same spirit as listennotes.ts's DEFAULT_MONTHLY_CAP;
// override with PODCHASER_MONTHLY_CAP once the real plan limit is known.
const DEFAULT_MONTHLY_CAP = 500;

function monthlyCap(): number {
  const n = Number(process.env.PODCHASER_MONTHLY_CAP);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MONTHLY_CAP;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

/** Test seam — reset the in-process token cache. */
export function __resetPodchaserTokenCache() {
  cachedToken = null;
}

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.PODCHASER_CLIENT_ID;
  const clientSecret = process.env.PODCHASER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null; // not configured — skip, never an error

  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
      cache: "no-store", // token endpoint — never cache the response itself
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return null;
    // Refresh a little early so a request never races an expiring token.
    const ttlMs = ((json.expires_in ?? 3600) - 60) * 1000;
    cachedToken = { value: json.access_token, expiresAt: Date.now() + ttlMs };
    return cachedToken.value;
  } catch {
    return null;
  }
}

/** Checked before every real GraphQL call — the kill-switch. */
async function withinMonthlyCap(): Promise<boolean> {
  const used = await getMonthlyUsage(PROVIDER);
  if (used >= monthlyCap()) {
    console.warn(`[podchaser] monthly cap (${monthlyCap()}) reached — skipping call`);
    return false;
  }
  return true;
}

type PodchaserReview = { text?: string | null; rating?: number | null };
type PodchaserList = { title?: string | null };
type PodchaserPodcast = {
  title?: string;
  webUrl?: string | null;
  rating?: number | null;
  ratingCount?: number | null;
  reviews?: { data?: PodchaserReview[] };
  lists?: { data?: PodchaserList[] };
};

// Best-effort GraphQL shape — see the file header re: unverified field names.
const SEARCH_QUERY = `
  query PodcastSearch($term: String!) {
    podcasts(searchTerm: $term, first: 5) {
      data {
        title
        webUrl
        rating
        ratingCount
        reviews(first: 3) {
          data { text rating }
        }
        lists(first: 3) {
          data { title }
        }
      }
    }
  }
`;

async function search(title: string, token: string): Promise<PodchaserPodcast[] | null> {
  if (!(await withinMonthlyCap())) return null;
  try {
    const res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: SEARCH_QUERY, variables: { term: title } }),
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { podcasts?: { data?: PodchaserPodcast[] } };
      errors?: unknown[];
    };
    if (json.errors && json.errors.length > 0) return null; // schema mismatch etc. — skip, don't guess
    void incrementMonthlyUsage(PROVIDER); // best-effort; never blocks the caller
    return json.data?.podcasts?.data ?? [];
  } catch {
    return null;
  }
}

/**
 * Critic-review + curated-genre-list signal for a title, plus the actual
 * review/list text as readable evidence. Null when unconfigured, no title
 * match, or any request failure — never throws (NO_HARD_DEPS_ON_EXTERNAL_APIS).
 */
export async function podchaserDiscussion(
  title: string,
): Promise<{ buzz: BuzzInput; evidence: EvidenceItem[] } | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const results = await search(title, token);
  if (!results) return null;
  const hit = results.find((p) => p.title && titlesMatch(p.title, title));
  if (!hit) return null;

  const reviews = hit.reviews?.data ?? [];
  const lists = hit.lists?.data ?? [];

  const buzz: BuzzInput = {};
  if (hit.rating != null) buzz.podchaserRating = hit.rating;
  const reviewCount = (hit.ratingCount ?? 0) + reviews.length + lists.length;
  if (reviewCount > 0) buzz.podchaserReviews = reviewCount;

  const evidence: EvidenceItem[] = [
    ...reviews
      .filter((r): r is { text: string; rating?: number | null } => Boolean(r.text))
      .map((r) => ({ source: "Podchaser", text: r.text, url: hit.webUrl ?? undefined })),
    ...lists
      .filter((l): l is { title: string } => Boolean(l.title))
      .map((l) => ({
        source: "Podchaser",
        text: `Featured on "${l.title}"`,
        url: hit.webUrl ?? undefined,
      })),
  ].slice(0, 3);

  if (Object.keys(buzz).length === 0 && evidence.length === 0) return null;
  return { buzz, evidence };
}
