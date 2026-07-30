import type { BuzzInput } from "@/src/core/recommend";
import { normalizeForMatch } from "./match";

/**
 * Listen Notes — the largest free podcast search API. Its Listen Score
 * (0–100 global popularity percentile) is a strong quality signal that
 * iTunes/Podcast Index don't expose. Server-side only, key via
 * LISTEN_NOTES_API_KEY.
 *
 * QUOTA SAFETY: the free plan's monthly quota is tiny. This used to be called
 * per user request across the WHOLE pool of show titles (charts / top-picks),
 * which is unbounded under traffic. It's now bounded on those routes to the
 * top few shows per request, and every result is cached for 7 days — so a
 * lookup costs at most one call per title per week. That makes it safe to
 * simply turn on by setting an API key.
 *
 * To enable: set LISTEN_NOTES_API_KEY (a free key from listennotes.com/api).
 * No key → zero API calls → recommendations fall back to the other signals.
 * The free quota is still small, so watch usage if traffic grows.
 */

const REVALIDATE_SECONDS = 7 * 24 * 60 * 60; // Listen Score moves slowly
const BASE = "https://listen-api.listennotes.com/api/v2";

function apiKey(): string | null {
  // Enabled whenever a key is present — safe now that callers bound how many
  // lookups run per request (see the chart/top-picks routes) and cache 7 days.
  return process.env.LISTEN_NOTES_API_KEY || null;
}

type LnResult = {
  title_original?: string;
  listen_score?: number | null;
};

const normalize = normalizeForMatch;

export async function listenNotesBuzz(title: string): Promise<BuzzInput | null> {
  const key = apiKey();
  if (!key) return null; // not enabled/configured — skip, never an error
  try {
    const url =
      `${BASE}/search?type=podcast&only_in=title&page_size=5` +
      `&q=${encodeURIComponent(title)}`;
    const res = await fetch(url, {
      headers: { "X-ListenAPI-Key": key },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { results?: LnResult[] };
    const results = json.results ?? [];
    const hit =
      results.find((r) => normalize(r.title_original ?? "") === normalize(title)) ??
      results[0];
    if (hit?.listen_score == null) return null;
    return { listenScore: hit.listen_score };
  } catch {
    return null;
  }
}
