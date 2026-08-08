import { describe, expect, it } from "vitest";
import {
  matchPocketCastsHistory,
  newSubscriptions,
  statusForPocketCasts,
  type PocketCastsEpisode,
} from "@/src/core/sync/pocketCastsMatch";

describe("statusForPocketCasts", () => {
  it("trusts the played flag rather than guessing from position", () => {
    // Only 10 seconds in, but Pocket Casts says played — its flag wins.
    expect(statusForPocketCasts({ playingStatus: 3, playedUpTo: 10, duration: 3600 })).toBe(
      "finished",
    );
  });

  it("treats a real position without the played flag as progress", () => {
    expect(statusForPocketCasts({ playingStatus: 2, playedUpTo: 900 })).toBe("in_progress");
  });

  it("leaves unplayed episodes alone", () => {
    expect(statusForPocketCasts({ playingStatus: 1, playedUpTo: 0 })).toBeNull();
  });

  it("ignores 'playing' with no actual progress", () => {
    expect(statusForPocketCasts({ playingStatus: 2, playedUpTo: 0 })).toBeNull();
  });

  it("ignores an entry reporting nothing useful", () => {
    expect(statusForPocketCasts({})).toBeNull();
  });
});

describe("matchPocketCastsHistory", () => {
  const saved = [
    { episodeId: "a", audioUrl: "https://cdn.example.com/a.mp3" },
    { episodeId: "b", audioUrl: "https://cdn.example.com/b.mp3" },
    { episodeId: "no-audio", audioUrl: undefined },
  ];

  it("matches through redirect wrappers and tracking params", () => {
    const history: PocketCastsEpisode[] = [
      {
        url: "https://dts.podtrac.com/redirect.mp3/https://cdn.example.com/a.mp3?src=pocketcasts",
        playingStatus: 3,
        playedUpTo: 1800,
      },
    ];
    expect(matchPocketCastsHistory(history, saved)).toEqual([
      { episodeId: "a", status: "finished", positionSec: 1800 },
    ]);
  });

  it("ignores history for episodes the user doesn't have saved", () => {
    const history: PocketCastsEpisode[] = [
      { url: "https://cdn.example.com/zzz.mp3", playingStatus: 3, playedUpTo: 60 },
    ];
    expect(matchPocketCastsHistory(history, saved)).toEqual([]);
  });

  it("skips saved episodes with no audio URL to match on", () => {
    const history: PocketCastsEpisode[] = [{ url: "", playingStatus: 3 }];
    expect(matchPocketCastsHistory(history, saved)).toEqual([]);
  });

  it("returns one update per matched episode", () => {
    const history: PocketCastsEpisode[] = [
      { url: "https://cdn.example.com/a.mp3", playingStatus: 3, playedUpTo: 100 },
      { url: "https://cdn.example.com/b.mp3", playingStatus: 2, playedUpTo: 45 },
    ];
    const out = matchPocketCastsHistory(history, saved);
    expect(out).toHaveLength(2);
    expect(out.find((u) => u.episodeId === "b")).toEqual({
      episodeId: "b",
      status: "in_progress",
      positionSec: 45,
    });
  });

  it("never emits a negative position", () => {
    const history: PocketCastsEpisode[] = [
      { url: "https://cdn.example.com/a.mp3", playingStatus: 3, playedUpTo: -5 },
    ];
    expect(matchPocketCastsHistory(history, saved)[0].positionSec).toBe(0);
  });
});

describe("newSubscriptions", () => {
  const existing = [
    { feedUrl: "https://feeds.example.com/daily.xml", title: "The Daily" },
    { feedUrl: undefined, title: "Imported by hand" },
  ];

  it("returns only shows not already saved", () => {
    const out = newSubscriptions(
      [
        { title: "The Daily", feedUrl: "https://feeds.example.com/daily.xml" },
        { title: "Darknet Diaries", feedUrl: "https://feeds.example.com/dd.xml", author: "JC" },
      ],
      existing,
    );
    expect(out).toEqual([
      { title: "Darknet Diaries", feedUrl: "https://feeds.example.com/dd.xml", author: "JC" },
    ]);
  });

  it("matches on feed URL despite tracking params and scheme differences", () => {
    const out = newSubscriptions(
      [{ title: "The Daily", feedUrl: "http://feeds.example.com/daily.xml?src=pocketcasts" }],
      existing,
    );
    expect(out).toEqual([]);
  });

  it("never reports removals — unsubscribing there can't delete a saved show", () => {
    // Pocket Casts returns nothing; the library still has The Daily.
    expect(newSubscriptions([], existing)).toEqual([]);
  });

  it("skips entries with no feed URL or no title rather than guessing", () => {
    const out = newSubscriptions(
      [
        { title: "No feed" },
        { feedUrl: "https://feeds.example.com/x.xml" },
        { title: "Good", feedUrl: "https://feeds.example.com/good.xml" },
      ],
      existing,
    );
    expect(out.map((s) => s.title)).toEqual(["Good"]);
  });

  it("dedupes a feed listed twice", () => {
    const out = newSubscriptions(
      [
        { title: "Dup", feedUrl: "https://feeds.example.com/d.xml" },
        { title: "Dup again", feedUrl: "https://feeds.example.com/d.xml" },
      ],
      [],
    );
    expect(out).toHaveLength(1);
  });
});
