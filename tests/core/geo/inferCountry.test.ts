import { describe, expect, it } from "vitest";
import { inferCountry } from "@/src/core/geo/inferCountry";

describe("inferCountry", () => {
  it("recognizes Hangul as Korea", () => {
    expect(inferCountry({ title: "김영하의 책 읽는 시간" })?.code).toBe("KR");
  });

  it("recognizes Hiragana/Katakana as Japan even alongside kanji", () => {
    expect(inferCountry({ title: "ゆる言語学ラジオ", description: "言語学のポッドキャスト" })?.code).toBe(
      "JP",
    );
  });

  it("recognizes Thai script", () => {
    expect(inferCountry({ title: "R U OK พอดแคสต์" })?.code).toBe("TH");
  });

  it("recognizes Vietnamese-exclusive letters", () => {
    expect(inferCountry({ title: "Có Gì Đâu - Podcast tiếng Việt" })?.code).toBe("VN");
  });

  it("splits Simplified Chinese to China via majority character-pair match", () => {
    // 个/这/们/时/说 are all Simplified forms.
    expect(
      inferCountry({ title: "这个时代的说话方式", description: "我们从后面写的书" })?.code,
    ).toBe("CN");
  });

  it("splits Traditional Chinese to Taiwan via majority character-pair match", () => {
    // 個/這/們/時/說 are all Traditional forms.
    expect(
      inferCountry({ title: "這個時代的說話方式", description: "我們從後面寫的書" })?.code,
    ).toBe("TW");
  });

  it("returns null for plain English/Latin text — too ambiguous to guess", () => {
    expect(inferCountry({ title: "The Daily", description: "News from The New York Times" })).toBeNull();
  });

  it("returns null for Arabic script — too many possible countries", () => {
    expect(inferCountry({ title: "بودكاست عربي" })).toBeNull();
  });

  it("returns null for Cyrillic script — too many possible countries", () => {
    expect(inferCountry({ title: "Русский подкаст" })).toBeNull();
  });

  it("returns null for empty/whitespace-only text", () => {
    expect(inferCountry({ title: "   " })).toBeNull();
  });

  it("a known mainland Chinese hosting platform overrides script detection", () => {
    // English-only title, but the feed is hosted on ximalaya.com.
    expect(
      inferCountry({ title: "English Title", feedUrl: "https://www.ximalaya.com/feed/123" })?.code,
    ).toBe("CN");
  });

  it("ignores a malformed feedUrl rather than throwing", () => {
    expect(() => inferCountry({ title: "Ep", feedUrl: "not a url" })).not.toThrow();
  });
});
