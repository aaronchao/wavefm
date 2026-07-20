import type { RawDoc } from "@/src/core/mining";
import { docLang, type HarvestSource, type Seed, USER_AGENT } from "./types";

/**
 * Reddit harvester. Searches for threads about the seed title; the extractor
 * keeps only the rec-seeking ones ("podcasts like X?"). Uses application-only
 * OAuth when REDDIT_CLIENT_ID/REDDIT_SECRET are set (reliable from GitHub
 * Actions' datacenter IPs), else falls back to the anonymous public JSON.
 * Best-effort: any failure returns null.
 */

type Listing = {
  data?: { children?: { data?: RedditPost }[] };
};
type RedditPost = {
  id?: string;
  title?: string;
  selftext?: string;
  author?: string;
  permalink?: string;
  subreddit?: string;
  created_utc?: number;
};

/** PURE: turn a Reddit search listing into harvest documents. */
export function parseRedditListing(json: unknown): RawDoc[] {
  const children = (json as Listing)?.data?.children;
  if (!Array.isArray(children)) return [];
  const out: RawDoc[] = [];
  for (const c of children) {
    const d = c?.data;
    if (!d?.id || !d.title) continue;
    const body = d.selftext ?? "";
    out.push({
      id: `reddit:${d.id}`,
      source: "reddit",
      lang: docLang(`${d.title} ${body}`),
      title: d.title,
      body,
      author: d.author ? `reddit:${d.author}` : "reddit:anon",
      url: d.permalink ? `https://www.reddit.com${d.permalink}` : undefined,
      postedAt: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : undefined,
    });
  }
  return out;
}

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
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { access_token?: string };
    return j.access_token ?? null;
  } catch {
    return null;
  }
}

async function harvest(seed: Seed): Promise<RawDoc[] | null> {
  const q = encodeURIComponent(`${seed.title} podcast`);
  const token = await oauthToken();
  const base = token ? "https://oauth.reddit.com" : "https://www.reddit.com";
  const headers: Record<string, string> = { "User-Agent": USER_AGENT };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(
      `${base}/search.json?q=${q}&limit=25&sort=relevance&t=year`,
      { headers },
    );
    if (!res.ok) return null;
    return parseRedditListing(await res.json());
  } catch {
    return null;
  }
}

export const redditSource: HarvestSource = { id: "reddit", mode: "seeded", harvest };
