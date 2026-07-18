import { describe, expect, it } from "vitest";
import { normalizeForMatch, titlesMatch } from "@/src/data/buzz/match";

describe("normalizeForMatch", () => {
  it("strips punctuation and podcast-y suffixes, collapses whitespace", () => {
    expect(normalizeForMatch("Dear Therapist — The Podcast")).toBe("dear therapist");
    expect(normalizeForMatch("Psychology In Seattle (Radio)")).toBe("psychology in seattle");
    expect(normalizeForMatch("  The   Daily  ")).toBe("the daily");
  });

  it("preserves CJK and drops 播客/电台 suffixes", () => {
    expect(normalizeForMatch("声东击西")).toBe("声东击西");
    expect(normalizeForMatch("日谈公园 播客")).toBe("日谈公园");
  });
});

describe("titlesMatch", () => {
  it("matches across punctuation/suffix differences", () => {
    expect(titlesMatch("Dear Therapist", "dear therapist — the podcast")).toBe(true);
    expect(titlesMatch("声东击西", "声东击西 电台")).toBe(true);
  });

  it("does not match different shows", () => {
    expect(titlesMatch("Dear Therapist", "Crypto Daily")).toBe(false);
  });

  it("empty/punctuation-only titles never match", () => {
    expect(titlesMatch("—", "!!!")).toBe(false);
    expect(titlesMatch("", "anything")).toBe(false);
  });
});
