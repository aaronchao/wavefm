import type { BuzzInput } from "@/src/core/recommend";
import type { EvidenceItem } from "@/src/data/catalog/types";
import { normalizeForMatch } from "./match";

/**
 * Bilibili presence via its public video search — a huge CN video/danmaku
 * platform where Chinese podcasts often get video cuts, clips, or reaction
 * discussion that the audio-only catalogs miss entirely. No key/auth needed,
 * but the endpoint is bot-filter-prone (Bilibili's risk control can 412 a
 * bare fetch or return a non-zero `code` on a plain request), so a
 * browser-like User-Agent + bilibili.com Referer are required and this stays
 * strictly best-effort: any failure returns null and the signal is simply
 * skipped (NO_HARD_DEPS_ON_EXTERNAL_APIS). Cached per title, daily.
 *
 * Endpoint (verified live, no signing required from a plain server fetch):
 *   GET https://api.bilibili.com/x/web-interface/search/type
 *       ?search_type=video&keyword=<title>
 * Response shape — `data.result[]` items carry (field names confirmed
 * against a live response, not just docs):
 *   - bvid: string (video id used in the watch URL)
 *   - title: string, may contain `<em class="keyword">…</em>` highlight tags
 *     around the matched query — stripped before title-matching
 *   - play: number — view count (popularity)
 *   - review: number — comment count
 *   - video_review: number — danmaku (in-video timed comments) count
 * Search is loose (returns lots of tangentially-related videos), so results
 * are filtered by normalized title containment before anything is counted —
 * same rationale as youtube.ts's evidence filter, just applied to the whole
 * signal here rather than only to evidence.
 */

const REVALIDATE_SECONDS = 24 * 60 * 60; // presence moves slowly
const TIMEOUT_MS = 6000;
const SEARCH_URL = "https://api.bilibili.com/x/web-interface/search/type";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

type BiliResultItem = {
  bvid?: string;
  title?: string;
  play?: number | string;
  review?: number | string;
  video_review?: number | string;
};

type Matched = {
  bvid: string;
  title: string;
  views: number;
  comments: number;
};

function stripHighlight(title: string): string {
  return title.replace(/<\/?em[^>]*>/g, "");
}

function toCount(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

async function fetchMatched(title: string): Promise<Matched[] | null> {
  try {
    const res = await fetch(
      `${SEARCH_URL}?search_type=video&keyword=${encodeURIComponent(title)}`,
      {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        next: { revalidate: REVALIDATE_SECONDS },
        headers: { "User-Agent": UA, Referer: "https://www.bilibili.com/" },
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      code?: number;
      data?: { result?: BiliResultItem[] };
    };
    if (json.code !== 0) return null; // risk-control / error response
    const needle = normalizeForMatch(title);
    if (!needle) return [];

    const seen = new Set<string>();
    const matched: Matched[] = [];
    for (const raw of json.data?.result ?? []) {
      const bvid = typeof raw.bvid === "string" ? raw.bvid : "";
      const cleanTitle = stripHighlight(raw.title ?? "");
      if (!bvid || seen.has(bvid) || !cleanTitle) continue;
      if (!normalizeForMatch(cleanTitle).includes(needle)) continue; // loosely-related, drop
      seen.add(bvid);
      matched.push({
        bvid,
        title: cleanTitle,
        views: toCount(raw.play),
        comments: toCount(raw.review) + toCount(raw.video_review),
      });
    }
    return matched;
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
  return { bilibiliVideos: matched.length, bilibiliViews: views, bilibiliComments: comments };
}

export async function bilibiliBuzz(title: string): Promise<BuzzInput | null> {
  const matched = await fetchMatched(title);
  if (matched === null) return null;
  if (matched.length === 0) return { bilibiliVideos: 0 };
  return tally(matched);
}

/** Buzz + the top few matched videos (title + watch URL) as readable evidence. */
export async function bilibiliDiscussion(
  title: string,
): Promise<{ buzz: BuzzInput; evidence: EvidenceItem[] } | null> {
  const matched = await fetchMatched(title);
  if (matched === null) return null;
  if (matched.length === 0) return { buzz: { bilibiliVideos: 0 }, evidence: [] };
  const evidence: EvidenceItem[] = matched
    .sort((a, b) => b.views - a.views)
    .slice(0, 3)
    .map((m) => ({
      source: "Bilibili",
      text: m.title,
      url: `https://www.bilibili.com/video/${m.bvid}/`,
    }));
  return { buzz: tally(matched), evidence };
}
