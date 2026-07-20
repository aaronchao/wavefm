import type { BuzzInput } from "@/src/core/recommend";
import type { EvidenceItem } from "@/src/data/catalog/types";

/**
 * Forum discussion sources: PTT (批踢踢), LIHKG (連登) and 豆瓣小组 — the
 * Chinese-community chatter wavefm ranks by. All three sit behind rate
 * limits / bot filters of varying moods, so each is strictly best-effort
 * with a hard timeout: any failure returns null and the signal is simply
 * skipped (NO_HARD_DEPS_ON_EXTERNAL_APIS). Cached per title, daily.
 * Each returns counts for ranking AND the actual threads for evidence.
 */

const REVALIDATE_SECONDS = 24 * 60 * 60;
const TIMEOUT_MS = 6000;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

type Discussion = { buzz: BuzzInput; evidence: EvidenceItem[] } | null;

async function fetchText(url: string, headers: Record<string, string> = {}): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { "User-Agent": UA, ...headers },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

const contains = (hay: string, title: string) =>
  hay.toLowerCase().includes(title.trim().toLowerCase());

/** PTT — the Podcast board's search, parsed from the public web UI. */
export async function pttDiscussion(title: string): Promise<Discussion> {
  const html = await fetchText(
    `https://www.ptt.cc/bbs/Podcast/search?q=${encodeURIComponent(title)}`,
    { Cookie: "over18=1" },
  );
  if (html === null) return null;
  const rows: { href: string; text: string }[] = [];
  const re = /<div class="title">\s*<a href="(\/bbs\/Podcast\/[^"]+)">([^<]+)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) rows.push({ href: m[1], text: m[2].trim() });
  const matched = rows.filter((r) => contains(r.text, title));
  if (matched.length === 0) return null;
  return {
    buzz: { pttMentions: matched.length },
    evidence: matched.slice(0, 2).map((r) => ({
      source: "PTT",
      text: r.text,
      url: `https://www.ptt.cc${r.href}`,
    })),
  };
}

/** LIHKG — the public thread-search JSON. Cloudflare may say no; fine. */
export async function lihkgDiscussion(title: string): Promise<Discussion> {
  const body = await fetchText(
    `https://lihkg.com/api_v2/thread/search?q=${encodeURIComponent(title)}&page=1&count=20&sort=score`,
    { Accept: "application/json", Referer: "https://lihkg.com/" },
  );
  if (body === null) return null;
  try {
    const json = JSON.parse(body) as {
      response?: { items?: { thread_id?: number; title?: string }[] };
    };
    const items = (json.response?.items ?? []).filter(
      (i) => i.title && i.thread_id && contains(i.title, title),
    );
    if (items.length === 0) return null;
    return {
      buzz: { lihkgMentions: items.length },
      evidence: items.slice(0, 2).map((i) => ({
        source: "LIHKG",
        text: i.title!,
        url: `https://lihkg.com/thread/${i.thread_id}`,
      })),
    };
  } catch {
    return null;
  }
}

/** 豆瓣小组 — group-topic search, parsed from the public results page. */
export async function doubanGroupDiscussion(title: string): Promise<Discussion> {
  const html = await fetchText(
    `https://www.douban.com/group/search?cat=1013&q=${encodeURIComponent(title)}`,
  );
  if (html === null) return null;
  const rows: { url: string; text: string }[] = [];
  const re =
    /href="(https:\/\/www\.douban\.com\/group\/topic\/\d+\/)"[^>]*>\s*([^<]{2,120}?)\s*</g;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(html)) !== null) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    rows.push({ url: m[1], text: m[2].trim() });
  }
  const matched = rows.filter((r) => contains(r.text, title));
  if (matched.length === 0) return null;
  return {
    buzz: { doubanMentions: matched.length },
    evidence: matched.slice(0, 2).map((r) => ({
      source: "豆瓣小组",
      text: r.text,
      url: r.url,
    })),
  };
}
