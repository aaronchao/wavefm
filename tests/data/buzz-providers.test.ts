import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Fetch-mocked tests for the buzz providers — the layer most likely to
 * drift with upstream APIs. Each provider must parse the happy path and
 * return null (never throw) on any failure. Module state is reset per
 * test so the in-process caches (xyzrank memo, xiaoyuzhou liveAccess)
 * don't leak between cases.
 */

type FetchHandler = (url: string, init?: RequestInit) => {
  ok?: boolean;
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
};

function mockFetch(handler: FetchHandler) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const r = handler(url, init);
      const status = r.status ?? (r.ok === false ? 500 : 200);
      return {
        ok: r.ok ?? status < 400,
        status,
        headers: new Headers(r.headers ?? {}),
        json: async () => r.body,
        text: async () => JSON.stringify(r.body),
      } as Response;
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  delete process.env.LISTEN_NOTES_API_KEY;
  delete process.env.XIAOYUZHOU_ACCESS_TOKEN;
  delete process.env.XIAOYUZHOU_REFRESH_TOKEN;
  delete process.env.YOUTUBE_API_KEY;
  delete process.env.REDDIT_CLIENT_ID;
  delete process.env.REDDIT_SECRET;
});

describe("listenNotesBuzz", () => {
  it("is silently absent without a key (no fetch)", async () => {
    const spy = vi.fn();
    mockFetch(() => {
      spy();
      return { body: {} };
    });
    const { listenNotesBuzz } = await import("@/src/data/buzz/listennotes");
    expect(await listenNotesBuzz("Dear Therapist")).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns the Listen Score for a title match", async () => {
    process.env.LISTEN_NOTES_API_KEY = "k"; // enabled whenever a key is present
    mockFetch(() => ({
      body: { results: [{ title_original: "Dear Therapist", listen_score: 72 }] },
    }));
    const { listenNotesBuzz } = await import("@/src/data/buzz/listennotes");
    expect(await listenNotesBuzz("dear therapist")).toEqual({ listenScore: 72 });
  });

  it("returns null on a 401 (never throws)", async () => {
    process.env.LISTEN_NOTES_API_KEY = "k";
    mockFetch(() => ({ status: 401, body: {} }));
    const { listenNotesBuzz } = await import("@/src/data/buzz/listennotes");
    expect(await listenNotesBuzz("Dear Therapist")).toBeNull();
  });
});

describe("listenNotesRelatedTitles", () => {
  it("is silently absent without a key (no fetch)", async () => {
    const spy = vi.fn();
    mockFetch(() => {
      spy();
      return { body: {} };
    });
    const { listenNotesRelatedTitles } = await import("@/src/data/buzz/listennotes");
    expect(await listenNotesRelatedTitles("Dear Therapist")).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns related titles from the recommendations endpoint", async () => {
    process.env.LISTEN_NOTES_API_KEY = "k";
    mockFetch((url) =>
      url.includes("/recommendations")
        ? { body: { recommendations: [{ title_original: "Show A" }, { title_original: "Show B" }] } }
        : { body: { results: [{ id: "ln1", title_original: "Dear Therapist", listen_score: 72 }] } },
    );
    const { listenNotesRelatedTitles } = await import("@/src/data/buzz/listennotes");
    expect(await listenNotesRelatedTitles("Dear Therapist")).toEqual(["Show A", "Show B"]);
  });

  it("returns null when the search finds no matching podcast id", async () => {
    process.env.LISTEN_NOTES_API_KEY = "k";
    mockFetch(() => ({ body: { results: [] } }));
    const { listenNotesRelatedTitles } = await import("@/src/data/buzz/listennotes");
    expect(await listenNotesRelatedTitles("Dear Therapist")).toBeNull();
  });

  it("returns null when the recommendations call fails (never throws)", async () => {
    process.env.LISTEN_NOTES_API_KEY = "k";
    mockFetch((url) =>
      url.includes("/recommendations")
        ? { status: 500, body: {} }
        : { body: { results: [{ id: "ln1", title_original: "Dear Therapist" }] } },
    );
    const { listenNotesRelatedTitles } = await import("@/src/data/buzz/listennotes");
    expect(await listenNotesRelatedTitles("Dear Therapist")).toBeNull();
  });
});

describe("xyzrankBuzz", () => {
  it("parses rank + 小宇宙 stats for a listed show", async () => {
    mockFetch(() => ({
      body: [
        { name: "声东击西", subscription: 120000, plays: 3000000, comments: 4200 },
        { name: "别的", subscription: 10 },
      ],
    }));
    const { xyzrankBuzz } = await import("@/src/data/buzz/xyzrank");
    expect(await xyzrankBuzz("声东击西")).toEqual({
      xyzrankRank: 1,
      subscribers: 120000,
      plays: 3000000,
      comments: 4200,
    });
  });

  it("returns null for an unlisted show", async () => {
    mockFetch(() => ({ body: [{ name: "别的播客" }] }));
    const { xyzrankBuzz } = await import("@/src/data/buzz/xyzrank");
    expect(await xyzrankBuzz("Dear Therapist")).toBeNull();
  });

  it("returns null when the endpoint fails", async () => {
    mockFetch(() => ({ status: 500, body: {} }));
    const { xyzrankBuzz } = await import("@/src/data/buzz/xyzrank");
    expect(await xyzrankBuzz("声东击西")).toBeNull();
  });
});

describe("xiaoyuzhouBuzz", () => {
  it("refreshes first when only a refresh token is set, then searches", async () => {
    process.env.XIAOYUZHOU_REFRESH_TOKEN = "refresh";
    const calls: string[] = [];
    mockFetch((url) => {
      calls.push(url);
      if (url.includes("app_auth_tokens.refresh")) {
        return { body: { "x-jike-access-token": "fresh-access" } };
      }
      return {
        body: {
          data: [
            { title: "声东击西", subscriptionCount: 1234, playCount: 5678, commentCount: 90 },
          ],
        },
      };
    });
    const { xiaoyuzhouBuzz } = await import("@/src/data/buzz/xiaoyuzhou");
    const buzz = await xiaoyuzhouBuzz("声东击西");
    expect(buzz).toEqual({ subscribers: 1234, plays: 5678, comments: 90 });
    expect(calls[0]).toContain("app_auth_tokens.refresh");
    expect(calls[1]).toContain("search/create");
  });

  it("is silently absent with no tokens at all", async () => {
    const spy = vi.fn();
    mockFetch(() => {
      spy();
      return { body: {} };
    });
    const { xiaoyuzhouBuzz } = await import("@/src/data/buzz/xiaoyuzhou");
    expect(await xiaoyuzhouBuzz("声东击西")).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("redditBuzz", () => {
  it("aggregates thread volume, score, and comments", async () => {
    mockFetch(() => ({
      body: {
        data: {
          children: [
            { data: { score: 40, num_comments: 12 } },
            { data: { score: 8, num_comments: 3 } },
          ],
        },
      },
    }));
    const { redditBuzz } = await import("@/src/data/buzz/reddit");
    expect(await redditBuzz("Dear Therapist")).toEqual({
      redditPosts: 2,
      redditScore: 48,
      redditComments: 15,
    });
  });

  it("returns null when Reddit blocks the request", async () => {
    mockFetch(() => ({ status: 403, body: {} }));
    const { redditBuzz } = await import("@/src/data/buzz/reddit");
    expect(await redditBuzz("Dear Therapist")).toBeNull();
  });

  it("uses application-only OAuth against oauth.reddit.com once credentials are set (REFINEMENTS.md #15)", async () => {
    process.env.REDDIT_CLIENT_ID = "id";
    process.env.REDDIT_SECRET = "secret";
    const seen: string[] = [];
    mockFetch((url) => {
      seen.push(url);
      if (url.includes("access_token")) return { body: { access_token: "tok" } };
      return { body: { data: { children: [{ data: { score: 5, num_comments: 1 } }] } } };
    });
    const { redditBuzz } = await import("@/src/data/buzz/reddit");
    expect(await redditBuzz("Dear Therapist")).toEqual({
      redditPosts: 1,
      redditScore: 5,
      redditComments: 1,
    });
    expect(seen.some((u) => u.startsWith("https://oauth.reddit.com/"))).toBe(true);
    expect(seen.some((u) => u.startsWith("https://www.reddit.com/search.json"))).toBe(false);
  });

  it("falls back to the anonymous endpoint when no OAuth credentials are set", async () => {
    const seen: string[] = [];
    mockFetch((url) => {
      seen.push(url);
      return { body: { data: { children: [] } } };
    });
    const { redditBuzz } = await import("@/src/data/buzz/reddit");
    await redditBuzz("Dear Therapist");
    expect(seen.some((u) => u.startsWith("https://www.reddit.com/search.json"))).toBe(true);
    expect(seen.some((u) => u.includes("access_token"))).toBe(false);
  });

  it("falls back to anonymous when the OAuth token request itself fails", async () => {
    process.env.REDDIT_CLIENT_ID = "id";
    process.env.REDDIT_SECRET = "secret";
    mockFetch((url) =>
      url.includes("access_token")
        ? { status: 500, body: {} }
        : { body: { data: { children: [] } } },
    );
    const { redditBuzz } = await import("@/src/data/buzz/reddit");
    expect(await redditBuzz("Dear Therapist")).toEqual({ redditPosts: 0 });
  });
});

describe("hackerNewsBuzz", () => {
  it("aggregates story volume, points, and comments", async () => {
    mockFetch(() => ({
      body: {
        hits: [
          { objectID: "1", title: "Show X is great", points: 120, num_comments: 44 },
          { objectID: "2", title: "Another thread", points: 10, num_comments: 6 },
        ],
      },
    }));
    const { hackerNewsBuzz } = await import("@/src/data/buzz/hackernews");
    expect(await hackerNewsBuzz("Show X")).toEqual({
      hnStories: 2,
      hnPoints: 130,
      hnComments: 50,
    });
  });

  it("returns zero-stories (not null) when the search is empty", async () => {
    mockFetch(() => ({ body: { hits: [] } }));
    const { hackerNewsBuzz } = await import("@/src/data/buzz/hackernews");
    expect(await hackerNewsBuzz("Obscure Show")).toEqual({ hnStories: 0 });
  });

  it("surfaces the top thread as evidence, sorted by points", async () => {
    mockFetch(() => ({
      body: {
        hits: [
          { objectID: "9", title: "low", points: 3, num_comments: 1 },
          { objectID: "42", title: "high", points: 200, num_comments: 90 },
        ],
      },
    }));
    const { hackerNewsDiscussion } = await import("@/src/data/buzz/hackernews");
    const res = await hackerNewsDiscussion("Show X");
    expect(res?.evidence[0]).toEqual({
      source: "Hacker News",
      text: "high",
      url: "https://news.ycombinator.com/item?id=42",
    });
  });

  it("returns null when Algolia fails (never throws)", async () => {
    mockFetch(() => ({ status: 500, body: {} }));
    const { hackerNewsBuzz } = await import("@/src/data/buzz/hackernews");
    expect(await hackerNewsBuzz("Show X")).toBeNull();
  });
});

describe("youtubeBuzz", () => {
  it("is silently absent without a key (no fetch)", async () => {
    const spy = vi.fn();
    mockFetch(() => {
      spy();
      return { body: {} };
    });
    const { youtubeBuzz } = await import("@/src/data/buzz/youtube");
    expect(await youtubeBuzz("Show X")).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("sums views and comments across matched videos", async () => {
    process.env.YOUTUBE_API_KEY = "k";
    mockFetch((url) => {
      if (url.includes("/search")) {
        return {
          body: {
            items: [
              { id: { videoId: "a" }, snippet: { title: "Show X ep 1" } },
              { id: { videoId: "b" }, snippet: { title: "Show X clip" } },
            ],
          },
        };
      }
      return {
        body: {
          items: [
            { id: "a", statistics: { viewCount: "1000", commentCount: "30" } },
            { id: "b", statistics: { viewCount: "500", commentCount: "20" } },
          ],
        },
      };
    });
    const { youtubeBuzz } = await import("@/src/data/buzz/youtube");
    expect(await youtubeBuzz("Show X")).toEqual({
      youtubeVideos: 2,
      youtubeViews: 1500,
      youtubeComments: 50,
    });
  });

  it("returns zero-videos when the search finds nothing", async () => {
    process.env.YOUTUBE_API_KEY = "k";
    mockFetch(() => ({ body: { items: [] } }));
    const { youtubeBuzz } = await import("@/src/data/buzz/youtube");
    expect(await youtubeBuzz("Show X")).toEqual({ youtubeVideos: 0 });
  });

  it("returns null on an API error (never throws)", async () => {
    process.env.YOUTUBE_API_KEY = "k";
    mockFetch(() => ({ status: 403, body: {} }));
    const { youtubeBuzz } = await import("@/src/data/buzz/youtube");
    expect(await youtubeBuzz("Show X")).toBeNull();
  });
});

describe("youtubeChannelUrl", () => {
  it("is silently absent without a key (no fetch)", async () => {
    const spy = vi.fn();
    mockFetch(() => {
      spy();
      return { body: {} };
    });
    const { youtubeChannelUrl } = await import("@/src/data/buzz/youtube");
    expect(await youtubeChannelUrl("Show X")).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns the top match's channel URL", async () => {
    process.env.YOUTUBE_API_KEY = "k";
    mockFetch(() => ({
      body: { items: [{ id: { videoId: "a" }, snippet: { title: "Show X ep 1", channelId: "UC123" } }] },
    }));
    const { youtubeChannelUrl } = await import("@/src/data/buzz/youtube");
    expect(await youtubeChannelUrl("Show X")).toBe("https://www.youtube.com/channel/UC123");
  });

  it("returns null when the search finds nothing", async () => {
    process.env.YOUTUBE_API_KEY = "k";
    mockFetch(() => ({ body: { items: [] } }));
    const { youtubeChannelUrl } = await import("@/src/data/buzz/youtube");
    expect(await youtubeChannelUrl("Show X")).toBeNull();
  });

  it("returns null on an API error (never throws)", async () => {
    process.env.YOUTUBE_API_KEY = "k";
    mockFetch(() => ({ status: 403, body: {} }));
    const { youtubeChannelUrl } = await import("@/src/data/buzz/youtube");
    expect(await youtubeChannelUrl("Show X")).toBeNull();
  });
});

describe("bilibiliBuzz", () => {
  it("sums views and comments+danmaku across title-matched videos only", async () => {
    mockFetch(() => ({
      body: {
        code: 0,
        data: {
          result: [
            {
              bvid: "BV1a",
              title: '<em class="keyword">Show X</em> 完整版',
              play: 1000,
              review: 30,
              video_review: 10,
            },
            {
              // loosely-related: doesn't mention the show at all
              bvid: "BV1b",
              title: "今天吃什么好呢",
              play: 999999,
              review: 999,
              video_review: 999,
            },
          ],
        },
      },
    }));
    const { bilibiliBuzz } = await import("@/src/data/buzz/bilibili");
    expect(await bilibiliBuzz("Show X")).toEqual({
      bilibiliVideos: 1,
      bilibiliViews: 1000,
      bilibiliComments: 40,
    });
  });

  it("returns zero-videos (not null) when nothing matches", async () => {
    mockFetch(() => ({
      body: {
        code: 0,
        data: { result: [{ bvid: "BV1c", title: "不相关的视频", play: 500, review: 5 }] },
      },
    }));
    const { bilibiliBuzz } = await import("@/src/data/buzz/bilibili");
    expect(await bilibiliBuzz("Show X")).toEqual({ bilibiliVideos: 0 });
  });

  it("surfaces the top matched video as evidence, sorted by views", async () => {
    mockFetch(() => ({
      body: {
        code: 0,
        data: {
          result: [
            { bvid: "BV1low", title: "Show X clip low", play: 10, review: 1 },
            { bvid: "BV1high", title: "Show X clip high", play: 5000, review: 2 },
          ],
        },
      },
    }));
    const { bilibiliDiscussion } = await import("@/src/data/buzz/bilibili");
    const res = await bilibiliDiscussion("Show X");
    expect(res?.evidence[0]).toEqual({
      source: "Bilibili",
      text: "Show X clip high",
      url: "https://www.bilibili.com/video/BV1high/",
    });
  });

  it("returns null when the request fails (never throws)", async () => {
    mockFetch(() => ({ status: 500, body: {} }));
    const { bilibiliBuzz } = await import("@/src/data/buzz/bilibili");
    expect(await bilibiliBuzz("Show X")).toBeNull();
  });

  it("returns null on a risk-control response (non-zero code)", async () => {
    mockFetch(() => ({ body: { code: -352, message: "风控" } }));
    const { bilibiliBuzz } = await import("@/src/data/buzz/bilibili");
    expect(await bilibiliBuzz("Show X")).toBeNull();
  });
});

describe("pocketCastsTrendingRanks", () => {
  it("maps iTunes id -> best 1-based rank across popular + trending", async () => {
    mockFetch((url) => {
      if (url.includes("popular")) {
        return { body: { podcasts: [{ itunes: 111 }, { itunes: 222 }] } };
      }
      // 222 appears higher (rank 1) on trending — the better rank should win
      return { body: { podcasts: [{ itunes: 222 }, { itunes: 333 }] } };
    });
    const { pocketCastsTrendingRanks, __resetPocketCastsMemo } = await import(
      "@/src/data/buzz/pocketcasts"
    );
    __resetPocketCastsMemo();
    const ranks = await pocketCastsTrendingRanks();
    expect(ranks?.get("111")).toBe(1);
    expect(ranks?.get("222")).toBe(1); // min(2 popular, 1 trending)
    expect(ranks?.get("333")).toBe(2);
  });

  it("returns null when every list is unreachable", async () => {
    mockFetch(() => ({ status: 503, body: {} }));
    const { pocketCastsTrendingRanks, __resetPocketCastsMemo } = await import(
      "@/src/data/buzz/pocketcasts"
    );
    __resetPocketCastsMemo();
    expect(await pocketCastsTrendingRanks()).toBeNull();
  });
});
