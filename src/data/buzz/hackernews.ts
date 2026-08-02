import type { BuzzInput } from "@/src/core/recommend";
import type { EvidenceItem } from "@/src/data/catalog/types";

/**
 * Hacker News discussion via the free Algolia search API — no key, server-side
 * only, cached per title. English tech/business/culture chatter that iTunes
 * and the Chinese forums miss. Same quality-discussion proxy as Reddit: how
 * many stories mention the show and how much traction (points + comments) they
 * got, plus the actual threads (title + HN permalink) for readable evidence.
 * Any failure returns null and the signal is simply skipped.
 */

const REVALIDATE_SECONDS = 24 * 60 * 60;
const BASE = "https://hn.algolia.com/api/v1/search";

type HnHit = {
  objectID?: string;
  title?: string;
  story_title?: string;
  url?: string;
  points?: number;
  num_comments?: number;
};

async function search(title: string): Promise<HnHit[] | null> {
  // Quotes keep the match tight to the show name; `tags=story` drops comments
  // and jobs so counts reflect real threads, matching the Reddit provider.
  const q = encodeURIComponent(`"${title}" podcast`);
  try {
    const res = await fetch(
      `${BASE}?query=${q}&tags=story&hitsPerPage=25`,
      {
        next: { revalidate: REVALIDATE_SECONDS },
        headers: { "User-Agent": "wavr/0.1 (personal podcast discovery)" },
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { hits?: HnHit[] };
    return json.hits ?? [];
  } catch {
    return null;
  }
}

function tally(hits: HnHit[]): BuzzInput {
  let points = 0;
  let comments = 0;
  for (const h of hits) {
    points += h.points ?? 0;
    comments += h.num_comments ?? 0;
  }
  return { hnStories: hits.length, hnPoints: points, hnComments: comments };
}

export async function hackerNewsBuzz(title: string): Promise<BuzzInput | null> {
  const hits = await search(title);
  if (hits === null) return null;
  if (hits.length === 0) return { hnStories: 0 };
  return tally(hits);
}

/** Buzz + the top few real threads (for readable discussion evidence). */
export async function hackerNewsDiscussion(
  title: string,
): Promise<{ buzz: BuzzInput; evidence: EvidenceItem[] } | null> {
  const hits = await search(title);
  if (hits === null) return null;
  const evidence: EvidenceItem[] = hits
    .filter((h) => (h.title || h.story_title) && h.objectID)
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    .slice(0, 2)
    .map((h) => ({
      source: "Hacker News",
      text: (h.title || h.story_title)!,
      url: `https://news.ycombinator.com/item?id=${h.objectID}`,
    }));
  return { buzz: tally(hits), evidence };
}
