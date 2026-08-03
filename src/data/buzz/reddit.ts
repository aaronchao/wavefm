import type { BuzzInput } from "@/src/core/recommend";
import type { EvidenceItem } from "@/src/data/catalog/types";

/**
 * Reddit discussion — server-side only, cached per title. Quality-
 * discussion proxy: how many threads mention the show and how much
 * traction they got, plus the actual threads (title + permalink) so Wavr
 * can show the real conversation.
 *
 * REFINEMENTS.md #15: reddit.com/search.json frequently 403s from
 * datacenter IPs (Vercel included) — the same reason the community-mining
 * Reddit harvester (src/data/mining/harvest/reddit.ts) already uses
 * application-only OAuth when REDDIT_CLIENT_ID/REDDIT_SECRET are set,
 * with the anonymous public JSON as a fallback. This mirrors that exact
 * pattern (not shared as a module — /data/buzz and /data/mining are
 * separate subsystems with their own User-Agent strings, and the helper
 * is ~15 lines). Any failure still returns null; the signal is simply
 * skipped either way (NO_HARD_DEPS_ON_EXTERNAL_APIS) — this only makes
 * the *success* path more reliable in production.
 */

const REVALIDATE_SECONDS = 24 * 60 * 60;
const USER_AGENT = "wavr/0.1 (personal podcast discovery)";

type RedditChild = {
  data?: {
    title?: string;
    permalink?: string;
    subreddit?: string;
    score?: number;
    num_comments?: number;
  };
};

async function oauthToken(): Promise<string | null> {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_SECRET;
  if (!id || !secret) return null;
  try {
    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body: "grant_type=client_credentials",
      cache: "no-store", // token endpoint — never cache the response itself
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { access_token?: string };
    return j.access_token ?? null;
  } catch {
    return null;
  }
}

async function search(title: string): Promise<RedditChild[] | null> {
  const q = encodeURIComponent(`"${title}" podcast`);
  const token = await oauthToken();
  const base = token ? "https://oauth.reddit.com" : "https://www.reddit.com";
  const headers: Record<string, string> = { "User-Agent": USER_AGENT };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(`${base}/search.json?q=${q}&limit=25&sort=relevance&t=year`, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers,
    });
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
