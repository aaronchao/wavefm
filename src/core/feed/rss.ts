/**
 * RSS builder for a user's personal Listen-Later feed (REFINEMENTS.md #2) —
 * pure, no I/O. Order is encoded via synthetic descending pubDates one
 * minute apart so a newest-first podcast app's default sort matches the
 * Queue order exactly. Episodes without a known audio URL are skipped —
 * no playable enclosure to offer. Includes <language> and, when a cover is
 * known, <itunes:image> — several clients (Pocket Casts included) reject
 * an add-by-URL feed missing these as "not a podcast" even though it's
 * valid RSS.
 */

export type FeedEpisode = {
  episodeId: string;
  title: string;
  audioUrl?: string;
  durationSec?: number;
  coverUrl?: string;
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
  const playable = episodes.filter(
    (e): e is FeedEpisode & { audioUrl: string } => Boolean(e.audioUrl),
  );
  const items = playable
    .map((e, i) => {
      const pubDate = new Date(base - i * 60_000).toUTCString();
      const duration =
        e.durationSec != null ? `\n      <itunes:duration>${e.durationSec}</itunes:duration>` : "";
      const image = e.coverUrl
        ? `\n      <itunes:image href="${escapeXml(e.coverUrl)}" />`
        : "";
      return `    <item>
      <title>${escapeXml(e.title)}</title>
      <guid isPermaLink="false">${escapeXml(e.episodeId)}</guid>
      <enclosure url="${escapeXml(e.audioUrl)}" type="audio/mpeg" length="0" />
      <pubDate>${pubDate}</pubDate>${duration}${image}
    </item>`;
    })
    .join("\n");
  // A channel-level itunes:image is required by Apple's podcast spec and
  // several clients (e.g. Pocket Casts) enforce similarly strict minimums
  // when validating an add-by-URL feed — there's no single canonical show
  // image for a personal cross-show queue, so the first playable episode's
  // real cover art stands in rather than fabricating one.
  const channelImage = playable.find((e) => e.coverUrl)?.coverUrl;
  const channelImageTag = channelImage
    ? `\n    <itunes:image href="${escapeXml(channelImage)}" />`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(meta.title)}</title>
    <description>${escapeXml(meta.description)}</description>
    <link>${escapeXml(meta.selfUrl)}</link>
    <atom:link href="${escapeXml(meta.selfUrl)}" rel="self" type="application/rss+xml" />
    <language>en-us</language>
    <itunes:explicit>false</itunes:explicit>${channelImageTag}
${items}
  </channel>
</rss>`;
}
