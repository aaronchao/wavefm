import { describe, expect, it } from "vitest";
import { buildOpml, parseOpml, stableFeedId } from "@/src/core/opml";

describe("buildOpml", () => {
  it("emits a valid OPML 2.0 outline per feed", () => {
    const xml = buildOpml([
      { title: "故事FM", feedUrl: "https://feeds.example/gushi", htmlUrl: "https://apple/gushi" },
      { title: "Radiolab", feedUrl: "https://feeds.example/radiolab" },
    ]);
    expect(xml).toContain('<opml version="2.0">');
    expect(xml).toContain('xmlUrl="https://feeds.example/gushi"');
    expect(xml).toContain('htmlUrl="https://apple/gushi"');
    expect(xml).toContain('text="故事FM"');
    expect((xml.match(/<outline /g) ?? []).length).toBe(2);
  });

  it("escapes XML-special characters in titles", () => {
    const xml = buildOpml([{ title: `A & B <"C">`, feedUrl: "https://f/x" }]);
    expect(xml).toContain("A &amp; B &lt;&quot;C&quot;&gt;");
    expect(xml).not.toContain('text="A & B');
  });

  it("skips feeds without a URL and dedupes by URL", () => {
    const xml = buildOpml([
      { title: "No feed", feedUrl: "" },
      { title: "Dupe A", feedUrl: "https://f/dup" },
      { title: "Dupe B", feedUrl: "https://f/dup" },
    ]);
    expect((xml.match(/<outline /g) ?? []).length).toBe(1);
    expect(xml).toContain("Dupe A");
    expect(xml).not.toContain("No feed");
  });

  it("never throws on empty input", () => {
    const xml = buildOpml([]);
    expect(xml).toContain("<body>");
    expect(xml).toContain("</opml>");
  });
});

describe("stableFeedId", () => {
  it("is deterministic, url-shape-insensitive, and rss-prefixed", () => {
    expect(stableFeedId("https://f/x")).toBe(stableFeedId("https://f/x"));
    expect(stableFeedId("https://F/X ")).toBe(stableFeedId("https://f/x"));
    expect(stableFeedId("https://f/x")).toMatch(/^rss-[a-z0-9]+$/);
    expect(stableFeedId("https://f/x")).not.toBe(stableFeedId("https://f/y"));
  });
});

describe("parseOpml", () => {
  it("extracts every feed outline, nested or flat, and decodes entities", () => {
    const xml = `<?xml version="1.0"?>
      <opml version="2.0"><body>
        <outline text="News">
          <outline type="rss" text="A &amp; B" xmlUrl="https://f/ab" htmlUrl="https://ab" />
        </outline>
        <outline type="rss" title="故事FM" xmlUrl="https://f/gushi"/>
      </body></opml>`;
    const feeds = parseOpml(xml);
    expect(feeds).toHaveLength(2); // the folder outline (no xmlUrl) is ignored
    expect(feeds[0]).toEqual({ feedUrl: "https://f/ab", title: "A & B", htmlUrl: "https://ab" });
    expect(feeds[1].title).toBe("故事FM");
    expect(feeds[1].feedUrl).toBe("https://f/gushi");
  });

  it("dedupes by feed URL and survives malformed input", () => {
    const xml = `<outline xmlUrl="https://f/x" text="One"/><outline xmlUrl="https://f/x" text="Dup"/>`;
    expect(parseOpml(xml)).toHaveLength(1);
    expect(parseOpml("not xml at all")).toEqual([]);
    expect(parseOpml("")).toEqual([]);
  });

  it("handles 小宇宙-style outlines: name in title, multi-line description in text", () => {
    const xml = `<opml version="2.0"><body>
      <outline title="击剑俱乐部" text="网罗大同故事，把握圈内趋势
观点锐利交锋

" xmlUrl="https://feed.xyzfm.space/a9vyu4q9fb6v" type="rss"/>
    </body></opml>`;
    const feeds = parseOpml(xml);
    expect(feeds).toHaveLength(1);
    expect(feeds[0].title).toBe("击剑俱乐部"); // NOT the description
    expect(feeds[0].description).toContain("网罗大同故事");
    expect(feeds[0].feedUrl).toBe("https://feed.xyzfm.space/a9vyu4q9fb6v");
  });

  it("round-trips with buildOpml", () => {
    const feeds = [
      { title: "故事FM", feedUrl: "https://f/gushi", htmlUrl: "https://apple/gushi" },
      { title: "Radiolab", feedUrl: "https://f/radiolab" },
    ];
    const parsed = parseOpml(buildOpml(feeds));
    expect(parsed.map((f) => f.feedUrl)).toEqual(feeds.map((f) => f.feedUrl));
    expect(parsed[0].title).toBe("故事FM");
  });
});
