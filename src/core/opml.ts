/**
 * OPML 2.0 export (PURE) — turns a list of podcast feeds into the
 * interchange format every podcast app (Pocket Casts, Overcast, AntennaPod…)
 * imports. Feed-level by nature: an OPML row is a subscription, so saved
 * episodes are represented by their parent show's feed. Feeds without a
 * URL are skipped and duplicates are collapsed by URL.
 */
export type OpmlFeed = {
  title: string;
  feedUrl: string;
  /** Optional human page (e.g. Apple Podcasts URL). */
  htmlUrl?: string;
  /** Some exporters (小宇宙) put the show description in `text`. */
  description?: string;
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&"); // last, so &amp;lt; doesn't double-decode
}

function parseAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([\w:.-]+)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) out[m[1].toLowerCase()] = decodeXml(m[2]);
  return out;
}

/**
 * Parse an OPML file (PURE) into the feeds it subscribes to — the inverse
 * of buildOpml, for importing a subscription list exported from another
 * podcast app. Tolerant of nesting and formatting: any <outline> carrying
 * an xmlUrl is a feed; everything else (folders, headers) is ignored.
 * Deduped by URL. Never throws on malformed input — returns what it can.
 */
export function parseOpml(xml: string): OpmlFeed[] {
  const feeds: OpmlFeed[] = [];
  const seen = new Set<string>();
  const outline = /<outline\b([^>]*?)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = outline.exec(xml)) !== null) {
    const attrs = parseAttrs(m[1]);
    const feedUrl = (attrs.xmlurl ?? "").trim();
    if (!feedUrl || seen.has(feedUrl)) continue;
    seen.add(feedUrl);
    // Standard OPML puts the name in `text`; 小宇宙 puts the name in `title`
    // and a long description in `text`. Prefer `title` so we never treat a
    // paragraph as the show's name, and keep the description when it differs.
    const title = (attrs.title || attrs.text || feedUrl).trim();
    const description =
      attrs.text && attrs.text.trim() !== title ? attrs.text.trim() : undefined;
    feeds.push({ feedUrl, title, htmlUrl: attrs.htmlurl || undefined, description });
  }
  return feeds;
}

/** Deterministic id for a feed-only show ("rss-<hash>") — no catalog needed. */
export function stableFeedId(feedUrl: string): string {
  let h = 5381;
  for (const ch of feedUrl.trim().toLowerCase()) {
    h = ((h * 33) ^ ch.codePointAt(0)!) >>> 0;
  }
  return `rss-${h.toString(36)}`;
}

export function buildOpml(feeds: OpmlFeed[], title = "wavefm subscriptions"): string {
  const seen = new Set<string>();
  const rows: string[] = [];
  for (const f of feeds) {
    const url = f.feedUrl?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const text = esc(f.title || url);
    const html = f.htmlUrl ? ` htmlUrl="${esc(f.htmlUrl)}"` : "";
    rows.push(
      `    <outline type="rss" text="${text}" title="${text}" xmlUrl="${esc(url)}"${html}/>`,
    );
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>${esc(title)}</title>
  </head>
  <body>
${rows.join("\n")}
  </body>
</opml>
`;
}
