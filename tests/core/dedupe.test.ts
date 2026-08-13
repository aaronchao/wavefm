import { describe, expect, it } from "vitest";
import {
  episodeIdsToRemove,
  findDuplicateGroups,
  pickKeeper,
  type DedupableEpisode,
} from "@/src/core/library/dedupe";

function ep(over: Partial<DedupableEpisode> = {}): DedupableEpisode {
  return {
    episodeId: "e1",
    showId: "s1",
    title: "Episode One",
    status: "queued",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...over,
  };
}

describe("findDuplicateGroups", () => {
  it("groups two rows with the same audio URL, different query strings", () => {
    const a = ep({ episodeId: "a", audioUrl: "https://cdn.example.com/ep.mp3?utm=x" });
    const b = ep({ episodeId: "b", audioUrl: "https://cdn.example.com/ep.mp3?ref=y" });
    const groups = findDuplicateGroups([a, b]);
    expect(groups).toHaveLength(1);
    expect(groups[0].map((e) => e.episodeId).sort()).toEqual(["a", "b"]);
  });

  it("groups rows with no audio URL by show + loose title", () => {
    const a = ep({ episodeId: "a", audioUrl: undefined, title: "Episode: One!" });
    const b = ep({ episodeId: "b", audioUrl: undefined, title: "episode one" });
    const groups = findDuplicateGroups([a, b]);
    expect(groups).toHaveLength(1);
  });

  it("does not group different shows with the same title", () => {
    const a = ep({ episodeId: "a", showId: "s1", audioUrl: undefined });
    const b = ep({ episodeId: "b", showId: "s2", audioUrl: undefined });
    expect(findDuplicateGroups([a, b])).toHaveLength(0);
  });

  it("does not group genuinely different audio", () => {
    const a = ep({ episodeId: "a", audioUrl: "https://cdn.example.com/one.mp3" });
    const b = ep({ episodeId: "b", audioUrl: "https://cdn.example.com/two.mp3" });
    expect(findDuplicateGroups([a, b])).toHaveLength(0);
  });

  it("returns nothing for an empty or dupe-free list", () => {
    expect(findDuplicateGroups([])).toEqual([]);
    expect(findDuplicateGroups([ep()])).toEqual([]);
  });
});

describe("pickKeeper", () => {
  it("prefers a row with real progress over an untouched queued one", () => {
    const queued = ep({ episodeId: "a", status: "queued", updatedAt: "2026-08-05T00:00:00.000Z" });
    const inProgress = ep({ episodeId: "b", status: "in_progress", updatedAt: "2026-08-01T00:00:00.000Z" });
    expect(pickKeeper([queued, inProgress]).episodeId).toBe("b");
  });

  it("falls back to most recently updated when engagement ties", () => {
    const older = ep({ episodeId: "a", status: "finished", updatedAt: "2026-08-01T00:00:00.000Z" });
    const newer = ep({ episodeId: "b", status: "finished", updatedAt: "2026-08-05T00:00:00.000Z" });
    expect(pickKeeper([older, newer]).episodeId).toBe("b");
  });

  it("is deterministic regardless of input order", () => {
    const a = ep({ episodeId: "a", status: "finished", updatedAt: "2026-08-05T00:00:00.000Z" });
    const b = ep({ episodeId: "b", status: "queued", updatedAt: "2026-08-06T00:00:00.000Z" });
    expect(pickKeeper([a, b]).episodeId).toBe("a");
    expect(pickKeeper([b, a]).episodeId).toBe("a");
  });
});

describe("episodeIdsToRemove", () => {
  it("keeps exactly one id per duplicate group, removes the rest", () => {
    const episodes = [
      ep({ episodeId: "a", audioUrl: "https://cdn.example.com/ep.mp3", status: "finished" }),
      ep({ episodeId: "b", audioUrl: "https://cdn.example.com/ep.mp3?x=1", status: "queued" }),
      ep({ episodeId: "c", showId: "s2", audioUrl: "https://cdn.example.com/other.mp3" }),
    ];
    expect(episodeIdsToRemove(episodes)).toEqual(["b"]);
  });

  it("is empty when nothing duplicates", () => {
    expect(episodeIdsToRemove([ep({ episodeId: "a" }), ep({ episodeId: "b", showId: "s2" })])).toEqual([]);
  });
});
