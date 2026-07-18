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
    process.env.LISTEN_NOTES_API_KEY = "k";
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
});
