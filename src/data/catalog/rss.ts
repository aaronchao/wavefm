import { XMLParser } from "fast-xml-parser";

/**
 * Server-side RSS enrichment: description + latest episode date, which
 * iTunes lookup doesn't provide. Best-effort with a hard timeout; any
 * failure returns {} and the caller ships un-enriched metadata.
 */

export type RssEnrichment = {
  description?: string;
  lastEpisodeAt?: string;
  categories?: string[];
};

export async function enrichFromRss(feedUrl: string): Promise<RssEnrichment> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(feedUrl, {
      signal: controller.signal,
      next: { revalidate: 6 * 60 * 60 },
      headers: { "User-Agent": "wavr/0.1 (personal podcast discovery)" },
    });
    clearTimeout(timer);
    if (!res.ok) return {};
    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false });
    const doc = parser.parse(xml) as {
      rss?: { channel?: Record<string, unknown> };
    };
    const channel = doc.rss?.channel;
    if (!channel) return {};

    const description =
      firstString(channel["itunes:summary"]) ?? firstString(channel.description);

    const items = channel.item;
    const first = Array.isArray(items) ? items[0] : items;
    const pubDate = firstString((first as Record<string, unknown> | undefined)?.pubDate);
    const lastEpisodeAt =
      pubDate && !Number.isNaN(Date.parse(pubDate))
        ? new Date(pubDate).toISOString()
        : undefined;

    const categories = collectCategories(channel["itunes:category"]);

    return { description, lastEpisodeAt, categories };
  } catch {
    return {};
  }
}

function firstString(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (Array.isArray(v)) return firstString(v[0]);
  if (v && typeof v === "object" && "#text" in v) {
    return firstString((v as Record<string, unknown>)["#text"]);
  }
  return undefined;
}

function collectCategories(v: unknown): string[] | undefined {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node === "object") {
      const rec = node as Record<string, unknown>;
      const text = rec["@_text"];
      if (typeof text === "string") out.push(text);
      walk(rec["itunes:category"]);
    }
  };
  walk(v);
  return out.length > 0 ? [...new Set(out)] : undefined;
}
