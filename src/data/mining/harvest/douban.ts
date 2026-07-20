import { XMLParser } from "fast-xml-parser";
import type { RawDoc } from "@/src/core/mining";
import { docLang, htmlToText, type HarvestSource, USER_AGENT } from "./types";

/**
 * Douban harvester (豆瓣小组). Douban's API has been closed since ~2015, so we
 * DON'T scrape it directly — we read group topic feeds through RSSHub (set
 * RSSHUB_BASE to your own instance for reliability; a public one works but is
 * rate-limited). Configure the podcast groups to watch via DOUBAN_GROUPS
 * (comma-separated group ids). Disabled (returns null) until groups are set.
 *
 * Wave-1 goes deep here: it's a "bulk" source — one fetch per group per run
 * yields many rec threads, and the extractor recovers each thread's seed.
 */

const parser = new XMLParser({ ignoreAttributes: false });

type RssItem = {
  title?: string;
  link?: string;
  description?: string;
  author?: string;
  pubDate?: string;
  "dc:creator"?: string;
};

/** PURE: parse an RSS/RSSHub feed into harvest documents. */
export function parseRssDocs(xml: string, source: string): RawDoc[] {
  let items: RssItem[] = [];
  try {
    const json = parser.parse(xml) as { rss?: { channel?: { item?: RssItem | RssItem[] } } };
    const raw = json?.rss?.channel?.item;
    items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  } catch {
    return [];
  }
  const out: RawDoc[] = [];
  for (const it of items) {
    const title = String(it?.title ?? "").trim();
    if (!title) continue;
    const link = typeof it?.link === "string" ? it.link : undefined;
    const body = htmlToText(String(it?.description ?? ""));
    const author = it?.author ?? it?.["dc:creator"];
    out.push({
      id: `${source}:${link ?? title}`,
      source,
      lang: docLang(`${title} ${body}`),
      title,
      body,
      author: author ? `${source}:${String(author)}` : `${source}:anon`,
      url: link,
      postedAt: it?.pubDate ? safeIso(String(it.pubDate)) : undefined,
    });
  }
  return out;
}

function safeIso(s: string): string | undefined {
  const t = Date.parse(s);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}

async function harvest(): Promise<RawDoc[] | null> {
  const groups = (process.env.DOUBAN_GROUPS ?? "")
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);
  if (groups.length === 0) return null; // not configured → cleanly disabled
  const base = (process.env.RSSHUB_BASE ?? "https://rsshub.app").replace(/\/$/, "");

  const out: RawDoc[] = [];
  let anyOk = false;
  for (const g of groups) {
    try {
      const res = await fetch(`${base}/douban/group/${encodeURIComponent(g)}`, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!res.ok) continue;
      anyOk = true;
      out.push(...parseRssDocs(await res.text(), "douban"));
    } catch {
      // one dead group/instance shouldn't abort the rest
    }
  }
  return anyOk ? out : null;
}

export const doubanSource: HarvestSource = { id: "douban", mode: "bulk", harvest };
