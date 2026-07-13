import type { BuzzInput } from "@/src/core/recommend";

/**
 * Reddit discussion volume via the free public JSON search — no key,
 * server-side only, cached per title. Quality-discussion proxy: how many
 * threads mention the show and how much traction they got. Reddit blocks
 * some datacenter IPs; any failure returns null and the signal is skipped.
 */

const REVALIDATE_SECONDS = 24 * 60 * 60;

type RedditChild = { data?: { score?: number; num_comments?: number } };

export async function redditBuzz(title: string): Promise<BuzzInput | null> {
  const q = encodeURIComponent(`"${title}" podcast`);
  try {
    const res = await fetch(
      `https://www.reddit.com/search.json?q=${q}&limit=25&sort=relevance&t=year`,
      {
        next: { revalidate: REVALIDATE_SECONDS },
        headers: { "User-Agent": "wavr/0.1 (personal podcast discovery)" },
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { children?: RedditChild[] } };
    const children = json.data?.children ?? [];
    if (children.length === 0) return { redditPosts: 0 };
    let score = 0;
    let comments = 0;
    for (const c of children) {
      score += c.data?.score ?? 0;
      comments += c.data?.num_comments ?? 0;
    }
    return {
      redditPosts: children.length,
      redditScore: score,
      redditComments: comments,
    };
  } catch {
    return null;
  }
}
