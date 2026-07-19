import type { BuzzInput } from "@/src/core/recommend";
import type { EvidenceItem } from "@/src/data/catalog/types";

/**
 * Reddit discussion via the free public JSON search — no key, server-side
 * only, cached per title. Quality-discussion proxy: how many threads mention
 * the show and how much traction they got, plus the actual threads (title +
 * permalink) so Wavr can show the real conversation. Reddit blocks some
 * datacenter IPs; any failure returns null and the signal is skipped.
 */

const REVALIDATE_SECONDS = 24 * 60 * 60;

type RedditChild = {
  data?: {
    title?: string;
    permalink?: string;
    subreddit?: string;
    score?: number;
    num_comments?: number;
  };
};

async function search(title: string): Promise<RedditChild[] | null> {
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
    return json.data?.children ?? [];
  } catch {
    return null;
  }
}

export async function redditBuzz(title: string): Promise<BuzzInput | null> {
  const children = await search(title);
  if (children === null) return null;
  if (children.length === 0) return { redditPosts: 0 };
  let score = 0;
  let comments = 0;
  for (const c of children) {
    score += c.data?.score ?? 0;
    comments += c.data?.num_comments ?? 0;
  }
  return { redditPosts: children.length, redditScore: score, redditComments: comments };
}

/** Buzz + the top few real threads (for readable discussion evidence). */
export async function redditDiscussion(
  title: string,
): Promise<{ buzz: BuzzInput; evidence: EvidenceItem[] } | null> {
  const children = await search(title);
  if (children === null) return null;
  let score = 0;
  let comments = 0;
  for (const c of children) {
    score += c.data?.score ?? 0;
    comments += c.data?.num_comments ?? 0;
  }
  const evidence: EvidenceItem[] = children
    .filter((c) => c.data?.title && c.data?.permalink)
    .sort((a, b) => (b.data?.score ?? 0) - (a.data?.score ?? 0))
    .slice(0, 2)
    .map((c) => ({
      source: c.data!.subreddit ? `r/${c.data!.subreddit}` : "Reddit",
      text: c.data!.title!,
      url: `https://www.reddit.com${c.data!.permalink}`,
    }));
  return {
    buzz: { redditPosts: children.length, redditScore: score, redditComments: comments },
    evidence,
  };
}
