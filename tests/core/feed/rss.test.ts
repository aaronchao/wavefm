import { describe, expect, it } from "vitest";
import { buildListenLaterRss } from "@/src/core/feed/rss";

const meta = { title: "My Queue", description: "desc", selfUrl: "https://wavr.example/feed/abc" };

describe("buildListenLaterRss", () => {
  it("emits one item per episode with an enclosure", () => {
    const xml = buildListenLaterRss(
      [{ episodeId: "1", title: "Ep One", audioUrl: "https://cdn/1.mp3", durationSec: 60 }],
      meta,
    );
    expect(xml).toContain("<title>Ep One</title>");
    expect(xml).toContain('<enclosure url="https://cdn/1.mp3"');
    expect(xml).toContain("<itunes:duration>60</itunes:duration>");
  });

  it("skips episodes with no audio URL", () => {
    const xml = buildListenLaterRss([{ episodeId: "1", title: "No Audio" }], meta);
    expect(xml).not.toContain("No Audio");
  });

  it("orders items newest-first matching queue order via descending pubDate", () => {
    const xml = buildListenLaterRss(
      [
        { episodeId: "a", title: "First", audioUrl: "https://cdn/a.mp3" },
        { episodeId: "b", title: "Second", audioUrl: "https://cdn/b.mp3" },
      ],
      meta,
    );
    const firstIdx = xml.indexOf("First");
    const secondIdx = xml.indexOf("Second");
    const firstDate = new Date(xml.slice(firstIdx, firstIdx + 400).match(/<pubDate>(.*)<\/pubDate>/)![1]);
    const secondDate = new Date(xml.slice(secondIdx, secondIdx + 400).match(/<pubDate>(.*)<\/pubDate>/)![1]);
    expect(firstDate.getTime()).toBeGreaterThan(secondDate.getTime());
  });

  it("escapes XML special characters in titles", () => {
    const xml = buildListenLaterRss(
      [{ episodeId: "1", title: 'A & B <fun> "show"', audioUrl: "https://cdn/1.mp3" }],
      meta,
    );
    expect(xml).toContain("A &amp; B &lt;fun&gt; &quot;show&quot;");
  });

  it("produces valid feed metadata even with an empty queue", () => {
    const xml = buildListenLaterRss([], meta);
    expect(xml).toContain("<title>My Queue</title>");
    expect(xml).toContain('rel="self"');
  });

  it("always includes a <language> tag — required by strict validators (e.g. Pocket Casts)", () => {
    expect(buildListenLaterRss([], meta)).toContain("<language>en-us</language>");
  });

  it("uses the first playable episode's cover as the channel image, and tags each item with its own", () => {
    const xml = buildListenLaterRss(
      [
        { episodeId: "1", title: "No Cover", audioUrl: "https://cdn/1.mp3" },
        { episodeId: "2", title: "Has Cover", audioUrl: "https://cdn/2.mp3", coverUrl: "https://cdn/cover.jpg" },
      ],
      meta,
    );
    expect(xml).toContain('<itunes:image href="https://cdn/cover.jpg" />');
    // Channel-level image appears once, before any <item>.
    expect(xml.indexOf('<itunes:image href="https://cdn/cover.jpg" />')).toBeLessThan(xml.indexOf("<item>"));
  });

  it("omits itunes:image entirely when no episode has a cover", () => {
    const xml = buildListenLaterRss(
      [{ episodeId: "1", title: "Ep", audioUrl: "https://cdn/1.mp3" }],
      meta,
    );
    expect(xml).not.toContain("itunes:image");
  });

  it("also emits a plain RSS <image> block and per-item <media:thumbnail> — some clients' artwork resolution (Pocket Casts reported) needs both, not itunes:image alone", () => {
    const xml = buildListenLaterRss(
      [{ episodeId: "1", title: "Has Cover", audioUrl: "https://cdn/1.mp3", coverUrl: "https://cdn/cover.jpg" }],
      meta,
    );
    expect(xml).toContain("xmlns:media=\"http://search.yahoo.com/mrss/\"");
    expect(xml).toContain("<image>");
    expect(xml).toContain("<url>https://cdn/cover.jpg</url>");
    expect(xml).toContain('<media:thumbnail url="https://cdn/cover.jpg" />');
  });

  it("gives every item its own <description> — some parsers skip per-item artwork resolution on feeds too minimal to have one", () => {
    const xml = buildListenLaterRss(
      [{ episodeId: "1", title: "Ep One", audioUrl: "https://cdn/1.mp3" }],
      meta,
    );
    expect(xml).toContain("<description>Ep One</description>");
  });
});
