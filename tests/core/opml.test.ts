import { describe, expect, it } from "vitest";
import { buildOpml } from "@/src/core/opml";

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
