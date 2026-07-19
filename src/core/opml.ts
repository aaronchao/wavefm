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
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildOpml(feeds: OpmlFeed[], title = "Wavr subscriptions"): string {
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
