/**
 * Pocket Casts trending/popular — the app's public Discover lists (no key,
 * no auth), the same JSON its own apps load. Each list entry carries the
 * show's iTunes id, so membership is a cross-platform popularity signal we
 * can map straight onto our iTunes-sourced shows. One cached fetch serves the
 * whole request pool; any failure returns null and the signal is skipped.
 *
 * These are curated *lists* (~100 shows each), not a per-title lookup — hence
 * a rank Map<itunesId, rank>, mirroring itunesTopChartRanks / piTrendingRanks.
 */

const REVALIDATE_SECONDS = 12 * 60 * 60; // the lists move a couple times a day
const LISTS = [
  "https://lists.pocketcasts.com/popular.json",
  "https://lists.pocketcasts.com/trending.json",
];

type PcPodcast = { itunes?: number | string };
type PcList = { podcasts?: PcPodcast[] };

// In-process memo so both routes that use this share one build per window.
let memo: { at: number; ranks: Map<string, number> } | null = null;
const MEMO_TTL_MS = REVALIDATE_SECONDS * 1000;

async function fetchList(url: string): Promise<Map<string, number>> {
  const ranks = new Map<string, number>();
  try {
    const res = await fetch(url, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { "User-Agent": "wavr/0.1 (personal podcast discovery)" },
    });
    if (!res.ok) return ranks;
    const json = (await res.json()) as PcList;
    (json.podcasts ?? []).forEach((p, i) => {
      const id = p.itunes != null ? String(p.itunes) : "";
      if (/^\d+$/.test(id) && !ranks.has(id)) ranks.set(id, i + 1); // 1-based
    });
  } catch {
    // best-effort — a dead list just contributes nothing
  }
  return ranks;
}

/**
 * Map of iTunes id -> best (lowest) 1-based position across the Pocket Casts
 * popular + trending lists. Null only when every list failed, so callers can
 * tell "not trending" (empty map) from "signal unavailable".
 */
export async function pocketCastsTrendingRanks(): Promise<Map<string, number> | null> {
  if (memo && Date.now() - memo.at < MEMO_TTL_MS) return memo.ranks;
  const lists = await Promise.all(LISTS.map(fetchList));
  if (lists.every((m) => m.size === 0)) return null; // nothing reachable
  const ranks = new Map<string, number>();
  for (const list of lists) {
    for (const [id, rank] of list) {
      const prev = ranks.get(id);
      if (prev == null || rank < prev) ranks.set(id, rank);
    }
  }
  memo = { at: Date.now(), ranks };
  return ranks;
}

/** Test seam — reset the in-process memo. */
export function __resetPocketCastsMemo() {
  memo = null;
}
