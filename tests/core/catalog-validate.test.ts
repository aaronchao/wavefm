import { describe, expect, it } from "vitest";
import {
  parseEpisode,
  parseEpisodes,
  parseShow,
  parseShows,
} from "@/src/core/catalog/validate";

describe("parseShow", () => {
  it("keeps a well-formed show", () => {
    const show = parseShow({
      id: "1", source: "itunes", title: "The Daily", author: "NYT",
      categories: ["News"], episodeCount: 900,
    });
    expect(show?.title).toBe("The Daily");
    expect(show?.categories).toEqual(["News"]);
  });

  it("rejects anything missing an id or title", () => {
    expect(parseShow({ title: "No id" })).toBeNull();
    expect(parseShow({ id: "1" })).toBeNull();
    expect(parseShow({ id: "1", title: "   " })).toBeNull();
  });

  it("rejects non-objects outright", () => {
    for (const v of [null, undefined, 42, "a string", []]) {
      expect(parseShow(v)).toBeNull();
    }
  });

  it("guarantees categories is an array — the field that crashed callers", () => {
    // `.categories.length` is read all over the UI; a non-array must never
    // reach it, whatever the payload says.
    for (const bad of [undefined, null, "News", 7, {}]) {
      expect(parseShow({ id: "1", title: "T", categories: bad })?.categories).toEqual([]);
    }
  });

  it("drops non-string entries inside categories", () => {
    const show = parseShow({ id: "1", title: "T", categories: ["News", 5, null, "Tech", ""] });
    expect(show?.categories).toEqual(["News", "Tech"]);
  });

  it("drops optional fields of the wrong type rather than failing the show", () => {
    const show = parseShow({
      id: "1", title: "T", coverUrl: 42, feedUrl: {}, episodeCount: "many",
      lastEpisodeAt: false,
    });
    expect(show).not.toBeNull();
    expect(show?.coverUrl).toBeUndefined();
    expect(show?.feedUrl).toBeUndefined();
    expect(show?.episodeCount).toBeUndefined();
    expect(show?.lastEpisodeAt).toBeUndefined();
  });

  it("defaults an unknown source instead of discarding a usable show", () => {
    expect(parseShow({ id: "1", title: "T", source: "wat" })?.source).toBe("rss");
  });

  it("keeps only string platform links, and omits the object when empty", () => {
    expect(parseShow({ id: "1", title: "T", platformLinks: { apple: "u", spotify: 9 } })?.platformLinks)
      .toEqual({ apple: "u" });
    expect(parseShow({ id: "1", title: "T", platformLinks: { spotify: 9 } })?.platformLinks)
      .toBeUndefined();
    expect(parseShow({ id: "1", title: "T", platformLinks: "nope" })?.platformLinks)
      .toBeUndefined();
  });

  it("never lets NaN or Infinity through as a number", () => {
    expect(parseShow({ id: "1", title: "T", episodeCount: NaN })?.episodeCount).toBeUndefined();
    expect(parseShow({ id: "1", title: "T", episodeCount: Infinity })?.episodeCount).toBeUndefined();
  });
});

describe("parseEpisode", () => {
  it("keeps a well-formed episode", () => {
    const ep = parseEpisode({ id: "e1", title: "Ep", durationSec: 1800, categories: [] });
    expect(ep?.durationSec).toBe(1800);
  });

  it("treats a non-positive duration as unknown, not as zero", () => {
    expect(parseEpisode({ id: "e", title: "T", durationSec: 0 })?.durationSec).toBeUndefined();
    expect(parseEpisode({ id: "e", title: "T", durationSec: -60 })?.durationSec).toBeUndefined();
  });

  it("rejects entries with no id or title", () => {
    expect(parseEpisode({ title: "T" })).toBeNull();
    expect(parseEpisode({ id: "e" })).toBeNull();
  });
});

describe("list parsing", () => {
  it("skips bad entries instead of failing the batch", () => {
    const shows = parseShows([
      { id: "1", title: "Good" },
      { title: "no id" },
      null,
      "garbage",
      { id: "2", title: "Also good" },
    ]);
    expect(shows.map((s) => s.id)).toEqual(["1", "2"]);
  });

  it("returns [] for a non-array", () => {
    expect(parseShows({ nope: true })).toEqual([]);
    expect(parseEpisodes(null)).toEqual([]);
  });
});
