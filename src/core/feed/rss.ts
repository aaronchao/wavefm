/**
 * RSS builder for a user's personal Listen-Later feed (REFINEMENTS.md #2) —
 * pure, no I/O. Order is encoded via synthetic descending pubDates one
 * minute apart so a newest-first podcast app's default sort matches the
 * Queue order exactly. Episodes without a known audio URL are skipped —
 * no playable enclosure to offer. Includes <language> and, when a cover is
 * known, <itunes:image> — several clients (Pocket Casts included) reject
 * an add-by-URL feed missing these as "not a podcast" even though it's
 * valid RSS.
 *
 * Per-episode artwork (reported broken in Pocket Casts — every episode
 * showed no cover at all, not even the show's own): the previous version
 * only emitted <itunes:image> per item and relied on <itunes:image> alone
 * at the channel level. That's spec-legal RSS, but several clients'
 * artwork pipeline only kicks in once the feed also has the plain RSS 2.0
 * <image> block (url/title/link) and each <item> has its own <description> —
 * without those, some parsers treat the feed as too minimal to bother
 * resolving per-item art and fall back to a blank placeholder instead of
 * even the channel image. <media:thumbnail> is added per item too, since
 * it's the other convention (Media RSS) podcast clients commonly check.
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
  /**
   * Absolute URL of the feed's own cover art. Without one the channel image
   * falls back to whichever episode happens to be first, so the feed shows
   * some unrelated show's artwork — see the channel-image note below.
   */
  imageUrl?: string;
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
        ? `\n      <itunes:image href="${escapeXml(e.coverUrl)}" />\n      <media:thumbnail url="${escapeXml(e.coverUrl)}" />`
        : "";
      return `    <item>
      <title>${escapeXml(e.title)}</title>
      <description>${escapeXml(e.title)}</description>
      <guid isPermaLink="false">${escapeXml(e.episodeId)}</guid>
      <enclosure url="${escapeXml(e.audioUrl)}" type="audio/mpeg" length="0" />
      <pubDate>${pubDate}</pubDate>${duration}${image}
    </item>`;
    })
    .join("\n");
  // A channel-level itunes:image is required by Apple's podcast spec and
  // several clients (e.g. Pocket Casts) enforce similarly strict minimums
  // when validating an add-by-URL feed. Prefer the feed's OWN cover
  // (`meta.imageUrl` — WaveFM's 3000x3000 art): this is one personal
  // playlist, not a show, so borrowing an episode's artwork made it look
  // like whichever podcast happened to sort first. That borrowed cover is
  // kept only as a fallback, since a feed with no channel image at all is
  // rejected outright by some clients. The plain RSS 2.0 <image> block is
  // added alongside itunes:image (not a substitute for it) — some clients'
  // artwork resolution only engages once this "vanilla" tag is present too.
  const channelImage = meta.imageUrl ?? playable.find((e) => e.coverUrl)?.coverUrl;
  const channelImageTag = channelImage
    ? `\n    <itunes:image href="${escapeXml(channelImage)}" />\n    <image>\n      <url>${escapeXml(channelImage)}</url>\n      <title>${escapeXml(meta.title)}</title>\n      <link>${escapeXml(meta.selfUrl)}</link>\n    </image>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
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
