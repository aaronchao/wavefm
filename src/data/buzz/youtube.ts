import type { BuzzInput } from "@/src/core/recommend";
import { sentimentOf } from "@/src/core/mining";
import type { EvidenceItem } from "@/src/data/catalog/types";
import { normalizeForMatch } from "./match";

/**
 * YouTube presence via the official Data API v3 — many podcasts publish full
 * episodes / clips on YouTube, so summed views are a real popularity signal
 * and summed comments a real discussion signal that the audio-only catalogs
 * miss. Server-side only, key via YOUTUBE_API_KEY.
 *
 * QUOTA SAFETY (mirrors listennotes.ts): a `search.list` costs 100 of the
 * 10,000 free daily units (~100 searches/day), so this must be BOUNDED at the
 * call sites (top few shows per request) and is cached 7 days — at most one
 * lookup per title per week. One extra `videos.list` (1 unit, batched) fetches
 * real view/comment counts for the matched videos.
 *
 * To enable: set YOUTUBE_API_KEY (a free key from the Google Cloud console,
 * "YouTube Data API v3"). No key → zero API calls → the other signals stand.
 */

const REVALIDATE_SECONDS = 7 * 24 * 60 * 60; // presence moves slowly
const BASE = "https://www.googleapis.com/youtube/v3";
const MAX_VIDEOS = 5;

function apiKey(): string | null {
  return process.env.YOUTUBE_API_KEY || null;
}

type SearchItem = {
  id?: { videoId?: string };
  snippet?: { title?: string; channelTitle?: string; channelId?: string };
};
type StatsItem = {
  id?: string;
  statistics?: { viewCount?: string; commentCount?: string };
};

type Matched = {
  videoId: string;
  /** Absent for the (rare) search result missing snippet.channelId. */
  channelId?: string;
  title: string;
  views: number;
  comments: number;
};

const normalize = normalizeForMatch;

async function fetchMatched(title: string): Promise<Matched[] | null> {
  const key = apiKey();
  if (!key) return null; // not enabled/configured — skip, never an error
  try {
    const searchUrl =
      `${BASE}/search?part=snippet&type=video&maxResults=${MAX_VIDEOS}` +
      `&q=${encodeURIComponent(`${title} podcast`)}&key=${key}`;
    const searchRes = await fetch(searchUrl, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!searchRes.ok) return null;
    const searchJson = (await searchRes.json()) as { items?: SearchItem[] };
    const found = (searchJson.items ?? [])
      .map((it) => ({
        videoId: it.id?.videoId,
        channelId: it.snippet?.channelId,
        title: it.snippet?.title ?? "",
      }))
      .filter((v): v is typeof v & { videoId: string } => Boolean(v.videoId));
    if (found.length === 0) return [];

    // one batched stats call (1 quota unit) for real view/comment counts
    const ids = found.map((v) => v.videoId).join(",");
    const statsRes = await fetch(
      `${BASE}/videos?part=statistics&id=${ids}&key=${key}`,
      { next: { revalidate: REVALIDATE_SECONDS } },
    );
    if (!statsRes.ok) return null;
    const statsJson = (await statsRes.json()) as { items?: StatsItem[] };
    const statsById = new Map(
      (statsJson.items ?? []).map((s) => [
        s.id,
        {
          views: Number(s.statistics?.viewCount ?? 0),
          comments: Number(s.statistics?.commentCount ?? 0),
        },
      ]),
    );
    return found.map((v) => ({
      videoId: v.videoId,
      channelId: v.channelId,
      title: v.title,
      views: statsById.get(v.videoId)?.views ?? 0,
      comments: statsById.get(v.videoId)?.comments ?? 0,
    }));
  } catch {
    return null;
  }
}

function tally(matched: Matched[]): BuzzInput {
  let views = 0;
  let comments = 0;
  for (const m of matched) {
    views += m.views;
    comments += m.comments;
  }
  return { youtubeVideos: matched.length, youtubeViews: views, youtubeComments: comments };
}

export async function youtubeBuzz(title: string): Promise<BuzzInput | null> {
  const matched = await fetchMatched(title);
  if (matched === null) return null;
  if (matched.length === 0) return { youtubeVideos: 0 };
  return tally(matched);
}

/**
 * A real, listenable YouTube link for a show that has no native presence
 * on YouTube Music (REFINEMENTS.md #6) — the named pain point: YT Music
 * has no add-by-RSS and no reliable show-search resolution, so its icon
 * has always fallen back to a search that often comes up empty. This
 * finds the best-matching video's own channel via the same search this
 * file already does for buzz (no extra API call) and returns the
 * channel page — actual content, not a search. Labelled "YouTube" rather
 * than "YouTube Music" wherever it's used (see src/core/links.ts), since
 * it opens youtube.com, not music.youtube.com — never claims a presence
 * on the Music app that isn't verifiable from this API.
 *
 * REQUIRES a normalized-title match (same check youtubeDiscussion uses for
 * evidence) before ever resolving a channel — this used to blindly trust
 * whatever video ranked #1 for `"<title>" podcast`, which for a niche or
 * short title frequently isn't actually the show at all, sending the user
 * to a completely unrelated channel. Better to return null (falls back to
 * the add-by-RSS deep link/search) than confidently link the wrong show.
 */
export async function youtubeChannelUrl(title: string): Promise<string | null> {
  const matched = await fetchMatched(title);
  if (!matched || matched.length === 0) return null;
  const relevant = matched.filter(
    (m): m is Matched & { channelId: string } =>
      Boolean(m.channelId) && normalize(m.title).includes(normalize(title)),
  );
  if (relevant.length === 0) return null;
  const best = relevant.sort((a, b) => b.views - a.views)[0];
  return `https://www.youtube.com/channel/${best.channelId}`;
}

/** Buzz + the top few videos (title + watch URL) as readable evidence. */
export async function youtubeDiscussion(
  title: string,
): Promise<{ buzz: BuzzInput; evidence: EvidenceItem[] } | null> {
  const matched = await fetchMatched(title);
  if (matched === null) return null;
  // Prefer videos whose title actually references the show, so evidence is
  // relevant even when the search returns loosely-related uploads.
  const relevant = matched.filter((m) => normalize(m.title).includes(normalize(title)));
  const evidence: EvidenceItem[] = (relevant.length > 0 ? relevant : matched)
    .sort((a, b) => b.views - a.views)
    .slice(0, 2)
    .map((m) => ({
      source: "YouTube",
      text: m.title,
      url: `https://www.youtube.com/watch?v=${m.videoId}`,
      sentiment: sentimentOf(m.title),
    }));
  return { buzz: tally(matched), evidence };
}
