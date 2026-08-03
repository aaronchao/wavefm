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
});
