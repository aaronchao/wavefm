import { describe, expect, it } from "vitest";
import {
  matchAppleEpisode,
  normalizeAudioUrl,
  titleKey,
  type AppleEpisodeCandidate,
} from "@/src/core/appleEpisode";

describe("normalizeAudioUrl", () => {
  it("ignores tracking query strings", () => {
    expect(normalizeAudioUrl("https://cdn.example.com/a.mp3?utm=1")).toBe(
      normalizeAudioUrl("https://cdn.example.com/a.mp3"),
    );
  });

  it("peels redirect-wrapper prefixes down to the real host", () => {
    const wrapped =
      "https://dts.podtrac.com/redirect.mp3/pdst.fm/e/https://cdn.example.com/a.mp3";
    expect(normalizeAudioUrl(wrapped)).toBe(normalizeAudioUrl("https://cdn.example.com/a.mp3"));
  });

  it("ignores scheme, www and trailing slash differences", () => {
    expect(normalizeAudioUrl("http://www.example.com/a.mp3/")).toBe("example.com/a.mp3");
  });
});

describe("titleKey", () => {
  it("ignores case and punctuation", () => {
    expect(titleKey("Ep. 12: Attachment Styles!")).toBe(titleKey("ep 12 attachment styles"));
  });

  it("keeps CJK characters", () => {
    expect(titleKey("第一集 開場")).toContain("第一集");
  });
});

describe("matchAppleEpisode", () => {
  const apple: AppleEpisodeCandidate[] = [
    {
      trackViewUrl: "https://podcasts.apple.com/x/id1?i=111",
      episodeUrl: "https://dts.podtrac.com/redirect.mp3/https://cdn.example.com/one.mp3",
      trackName: "Episode One",
    },
    {
      trackViewUrl: "https://podcasts.apple.com/x/id1?i=222",
      episodeUrl: "https://cdn.example.com/two.mp3",
      trackName: "Episode Two",
    },
  ];

  it("matches on the audio URL even through a redirect wrapper", () => {
    const url = matchAppleEpisode(apple, {
      audioUrl: "https://cdn.example.com/one.mp3?src=rss",
      title: "totally different title",
    });
    expect(url).toBe("https://podcasts.apple.com/x/id1?i=111");
  });

  it("falls back to an unambiguous title match when no audio URL is held", () => {
    expect(matchAppleEpisode(apple, { title: "episode two" })).toBe(
      "https://podcasts.apple.com/x/id1?i=222",
    );
  });

  it("refuses an ambiguous title rather than risk the wrong episode", () => {
    const dupes: AppleEpisodeCandidate[] = [
      { trackViewUrl: "a", trackName: "Episode 1" },
      { trackViewUrl: "b", trackName: "Episode 1" },
    ];
    expect(matchAppleEpisode(dupes, { title: "Episode 1" })).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(matchAppleEpisode(apple, { audioUrl: "https://x/none.mp3", title: "nope" })).toBeNull();
  });

  it("ignores candidates with no trackViewUrl", () => {
    const noUrl: AppleEpisodeCandidate[] = [
      { episodeUrl: "https://cdn.example.com/one.mp3", trackName: "Episode One" },
    ];
    expect(matchAppleEpisode(noUrl, { audioUrl: "https://cdn.example.com/one.mp3", title: "x" })).toBeNull();
  });

  it("audio-URL match wins over a conflicting title match", () => {
    const url = matchAppleEpisode(apple, {
      audioUrl: "https://cdn.example.com/two.mp3",
      title: "Episode One",
    });
    expect(url).toBe("https://podcasts.apple.com/x/id1?i=222");
  });
});
