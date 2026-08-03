import { afterEach, describe, expect, it, vi } from "vitest";
import { appleRating } from "@/src/data/ratings/apple";
import { runLadder } from "@/src/data/ratings/ladder";

/** Minimal fetch stub keyed by a per-URL handler (mirrors buzz-providers). */
function mockFetch(handler: (url: string) => { ok?: boolean; body?: unknown }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      const r = handler(url);
      const ok = r.ok ?? true;
      return { ok, status: ok ? 200 : 500, json: async () => r.body } as Response;
    }),
  );
}

/** Build an Apple customer-reviews feed body from a list of star ratings. */
function reviewsBody(stars: number[]) {
  return { feed: { entry: stars.map((n) => ({ "im:rating": { label: String(n) } })) } };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("appleRating", () => {
  it("returns null for a non-iTunes id, without fetching", async () => {
    const spy = vi.fn();
    mockFetch(() => {
      spy();
      return { body: {} };
    });
    expect(await appleRating("Some Show", "pi-42")).toBeNull();
    expect(await appleRating("Some Show", undefined)).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("averages recent US review stars to a 0..10 score", async () => {
    mockFetch(() => ({ body: reviewsBody([5, 4, 5]) })); // avg 4.667 → ×2 → 9.3
    expect(await appleRating("Show", "123")).toBe(9.3);
  });

  it("falls through to a Chinese storefront when US has too few reviews", async () => {
    const seen: string[] = [];
    mockFetch((url) => {
      seen.push(url);
      if (url.includes("/us/")) return { body: reviewsBody([5]) }; // below MIN_REVIEWS
      if (url.includes("/tw/")) return { body: reviewsBody([4, 4, 4]) };
      return { body: reviewsBody([]) };
    });
    expect(await appleRating("華語播客", "999")).toBe(8);
    expect(seen[0]).toContain("/us/");
    expect(seen[1]).toContain("/tw/");
  });

  it("returns null when no storefront has enough reviews", async () => {
    mockFetch(() => ({ body: reviewsBody([5]) })); // one review everywhere
    expect(await appleRating("Obscure", "123")).toBeNull();
  });

  it("never throws on an API failure", async () => {
    mockFetch(() => ({ ok: false, body: {} }));
    expect(await appleRating("Show", "123")).toBeNull();
  });
});

describe("runLadder (Section 7 fallback ladder)", () => {
  it("returns the first rung that resolves a rating", async () => {
    const calls: string[] = [];
    const rating = await runLadder([
      async () => {
        calls.push("official");
        return null;
      },
      async () => {
        calls.push("unofficial");
        return 8.7;
      },
      async () => {
        calls.push("scrape");
        return 5;
      },
    ]);
    expect(rating).toBe(8.7);
    expect(calls).toEqual(["official", "unofficial"]); // later rungs skipped
  });

  it("swallows throwing rungs and falls through", async () => {
    const rating = await runLadder([
      async () => {
        throw new Error("blocked by robots");
      },
      async () => 7.5,
    ]);
    expect(rating).toBe(7.5);
  });

  it("returns null when every rung fails — never throws", async () => {
    await expect(
      runLadder([
        async () => {
          throw new Error("403");
        },
        async () => null,
        async () => Number.NaN,
      ]),
    ).resolves.toBeNull();
  });

  it("returns null for an empty ladder", async () => {
    await expect(runLadder([])).resolves.toBeNull();
  });
});
