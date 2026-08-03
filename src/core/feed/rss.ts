/**
 * RSS builder for a user's personal Listen-Later feed (REFINEMENTS.md #2) —
 * pure, no I/O. Order is encoded via synthetic descending pubDates one
 * minute apart so a newest-first podcast app's default sort matches the
 * Queue order exactly. Episodes without a known audio URL are skipped —
 * no playable enclosure to offer.
 */

export type FeedEpisode = {
  episodeId: string;
  title: string;
  audioUrl?: string;
  durationSec?: number;
};

export type FeedMeta = {
  title: string;
  description: string;
  /** The feed's own URL (RSS <link>/<atom:link>). */
  selfUrl: string;
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildListenLaterRss(episodes: FeedEpisode[], meta: FeedMeta): string {
  const base = Date.now();
  const items = episodes
    .filter((e): e is FeedEpisode & { audioUrl: string } => Boolean(e.audioUrl))
    .map((e, i) => {
      const pubDate = new Date(base - i * 60_000).toUTCString();
      const duration =
        e.durationSec != null ? `\n      <itunes:duration>${e.durationSec}</itunes:duration>` : "";
      return `    <item>
      <title>${escapeXml(e.title)}</title>
      <guid isPermaLink="false">${escapeXml(e.episodeId)}</guid>
      <enclosure url="${escapeXml(e.audioUrl)}" type="audio/mpeg" length="0" />
      <pubDate>${pubDate}</pubDate>${duration}
    </item>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(meta.title)}</title>
    <description>${escapeXml(meta.description)}</description>
    <link>${escapeXml(meta.selfUrl)}</link>
    <atom:link href="${escapeXml(meta.selfUrl)}" rel="self" type="application/rss+xml" />
    <itunes:explicit>false</itunes:explicit>
${items}
  </channel>
</rss>`;
}
