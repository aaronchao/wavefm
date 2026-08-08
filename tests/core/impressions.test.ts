import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The suite runs in plain node — no jsdom, and this is the only DOM-touching
 * module worth covering, so a tiny in-memory stub beats adding a browser
 * environment dependency for one file. `impressionsRepo` guards on
 * `typeof window`, so both have to exist.
 */
const store = new Map<string, string>();
const localStorageStub = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};
vi.stubGlobal("window", { localStorage: localStorageStub });
vi.stubGlobal("localStorage", localStorageStub);

const { bumpImpressions, getImpressions } = await import("@/src/data/repos/impressionsRepo");

const KEY = "wavr.impressions.v1";

describe("getImpressions", () => {
  beforeEach(() => store.clear());

  it("round-trips real counts", () => {
    bumpImpressions(["a", "b", "a"]);
    expect(getImpressions()).toEqual({ a: 2, b: 1 });
  });

  it("drops non-numeric values rather than feeding NaN into scoring", () => {
    // A NaN fatigue penalty propagates through every candidate's score and
    // silently scrambles the whole ranking — the reason this is validated.
    store.set(KEY, JSON.stringify({ good: 3, bad: "lots", worse: null }));
    expect(getImpressions()).toEqual({ good: 3 });
  });

  it("drops NaN, Infinity and non-positive counts", () => {
    store.set(KEY, '{"a":null,"b":0,"c":-2,"d":4}');
    expect(getImpressions()).toEqual({ d: 4 });
  });

  it("survives corrupt or unexpected JSON", () => {
    store.set(KEY, "not json at all");
    expect(getImpressions()).toEqual({});
    store.set(KEY, "[1,2,3]");
    expect(getImpressions()).toEqual({});
    store.set(KEY, "null");
    expect(getImpressions()).toEqual({});
  });
});
