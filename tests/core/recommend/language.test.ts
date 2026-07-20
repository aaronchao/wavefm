import { describe, expect, it } from "vitest";
import { detectLang, sameLanguage, shouldLanguageFilter } from "@/src/core/recommend";

describe("detectLang", () => {
  it("reads a Han-heavy title as Chinese, even mixed with Latin", () => {
    expect(detectLang("故事FM")).toBe("zh");
    expect(detectLang("忽左忽右")).toBe("zh");
    expect(detectLang("大内密谈 · a talk show")).toBe("zh");
  });

  it("keeps English shows English", () => {
    expect(detectLang("The Daily")).toBe("en");
    expect(detectLang("Radiolab")).toBe("en");
  });

  it("separates Japanese and Korean from Chinese by kana/hangul", () => {
    expect(detectLang("ゆる言語学ラジオ")).toBe("ja"); // has kana
    expect(detectLang("김어준의 뉴스공장")).toBe("ko"); // has hangul
  });

  it("returns 'other' when there's nothing meaningful", () => {
    expect(detectLang("")).toBe("other");
    expect(detectLang("123 — !!!")).toBe("other");
  });
});

describe("sameLanguage / shouldLanguageFilter", () => {
  it("matches a Chinese seed only to Chinese candidates", () => {
    expect(sameLanguage("zh", "无聊斋")).toBe(true);
    expect(sameLanguage("zh", "The Joe Rogan Experience")).toBe(false);
  });

  it("only hard-filters non-Latin seeds", () => {
    expect(shouldLanguageFilter("zh")).toBe(true);
    expect(shouldLanguageFilter("ja")).toBe(true);
    expect(shouldLanguageFilter("ko")).toBe(true);
    expect(shouldLanguageFilter("en")).toBe(false);
    expect(shouldLanguageFilter("other")).toBe(false);
  });
});
