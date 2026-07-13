import type { BuzzInput } from "@/src/core/recommend";

/**
 * Listen Notes — the largest free podcast search API. Its Listen Score
 * (0–100 global popularity percentile) is a strong quality signal that
 * iTunes/Podcast Index don't expose. Server-side only, key via
 * LISTEN_NOTES_API_KEY; silently absent when unset. The free plan has a
 * small monthly quota, so we query it only for finalists and cache hard.
 */

const REVALIDATE_SECONDS = 7 * 24 * 60 * 60; // Listen Score moves slowly
const BASE = "https://listen-api.listennotes.com/api/v2";

function apiKey(): string | null {
  return process.env.LISTEN_NOTES_API_KEY || null;
}

type LnResult = {
  title_original?: string;
  listen_score?: number | null;
};

const normalize = (t: string) => t.trim().toLowerCase();

export async function listenNotesBuzz(title: string): Promise<BuzzInput | null> {
  const key = apiKey();
  if (!key) return null; // not configured — skip, never an error
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
