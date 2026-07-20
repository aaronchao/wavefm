import type { BuzzInput } from "@/src/core/recommend";
import type { EvidenceItem } from "@/src/data/catalog/types";

/**
 * V2EX discussion via sov2ex (the community's free full-text search over
 * V2EX). Server-side only, cached per title. A niche but high-signal Chinese
 * tech/interest community — exactly the forum chatter Wavr wants to surface
 * over the mainstream charts. Returns the mention count and the actual
 * threads (title + link). Any failure returns null and the signal is skipped.
 */

const REVALIDATE_SECONDS = 24 * 60 * 60;

type SovHit = { _source?: { title?: string; id?: number } };

async function search(title: string): Promise<SovHit[] | null> {
  const q = encodeURIComponent(`${title} 播客`);
  try {
    const res = await fetch(
      `https://www.sov2ex.com/api/search?q=${q}&size=20&sort=sumup`,
      {
        next: { revalidate: REVALIDATE_SECONDS },
        headers: { "User-Agent": "wavr/0.1 (personal podcast discovery)" },
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { hits?: SovHit[] };
    return json.hits ?? [];
  } catch {
    return null;
  }
}

function relevant(hits: SovHit[], title: string): SovHit[] {
  const needle = title.trim().toLowerCase();
  return hits.filter((h) => (h._source?.title ?? "").toLowerCase().includes(needle));
}

export async function v2exBuzz(title: string): Promise<BuzzInput | null> {
  const hits = await search(title);
  if (hits === null) return null;
  const mentions = relevant(hits, title).length;
  if (mentions === 0) return null;
  return { v2exMentions: mentions };
}

/** Buzz + the top few real V2EX threads (for readable discussion evidence). */
export async function v2exDiscussion(
  title: string,
): Promise<{ buzz: BuzzInput; evidence: EvidenceItem[] } | null> {
  const hits = await search(title);
  if (hits === null) return null;
  const matched = relevant(hits, title);
  if (matched.length === 0) return null;
  const evidence: EvidenceItem[] = matched
    .filter((h) => h._source?.title && h._source?.id)
    .slice(0, 2)
    .map((h) => ({
      source: "V2EX",
      text: h._source!.title!,
      url: `https://www.v2ex.com/t/${h._source!.id}`,
    }));
  return { buzz: { v2exMentions: matched.length }, evidence };
}
