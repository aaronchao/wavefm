import { afterEach, describe, expect, it, vi } from "vitest";
import { getRatings } from "@/src/data/ratings/client";

function mockFetch(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, json: async () => body }) as Response),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("getRatings (§5 P2 — malformed-200 hardening)", () => {
  it("returns the ratings array on a normal response", async () => {
    mockFetch({ ratings: [{ source: "douban", rating: 8.5 }] });
    expect(await getRatings("1", "Show")).toEqual([{ source: "douban", rating: 8.5 }]);
  });

  it("returns [] instead of throwing when ratings is a non-array shape", async () => {
    mockFetch({ ratings: "unexpected string" });
    expect(await getRatings("1", "Show")).toEqual([]);
  });

  it("returns [] when the field is missing entirely", async () => {
    mockFetch({});
    expect(await getRatings("1", "Show")).toEqual([]);
  });

  it("returns [] on a non-ok response", async () => {
    mockFetch({}, false);
    expect(await getRatings("1", "Show")).toEqual([]);
  });

  it("returns [] immediately for an empty explicit sources list, without fetching", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    expect(await getRatings("1", "Show", [])).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });
});
