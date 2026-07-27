import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard for the hard constraint in docs/wavr-route-design.md §8.1: Wavr
 * recommends from the user's OWN interest tags matched against NLP-parsed
 * discussion text. No collaborative filtering — no user-item matrix, no
 * neighbourhood, no cross-user co-occurrence.
 *
 * A rule nobody enforces is a rule that quietly rots, so this fails the build
 * if CF vocabulary shows up in the engine's source.
 */

const DIR = path.resolve(__dirname, "../../../src/core/wavr");

/** Comments discuss the constraint by name; only real code should be scanned. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  { pattern: /\buserId\b/, why: "an engine that knows user identities can join across them" },
  { pattern: /\bother_?[Uu]sers?\b/, why: "another user's data must never reach the engine" },
  { pattern: /\bneighbou?rs?\b/i, why: "neighbourhood lookup is collaborative filtering" },
  { pattern: /\bco_?occur/i, why: "cross-user co-occurrence is collaborative filtering" },
  { pattern: /\buserSimilarity\b/i, why: "user-user similarity is collaborative filtering" },
  { pattern: /\buserItem\b/i, why: "a user-item matrix is collaborative filtering" },
  { pattern: /\balsoLiked\b/i, why: '"users who liked this also liked" is collaborative filtering' },
];

function sources(): { file: string; code: string }[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => ({
      file: f,
      code: stripComments(readFileSync(path.join(DIR, f), "utf8")),
    }));
}

describe("the Wavr engine stays free of collaborative filtering", () => {
  it("has sources to check", () => {
    expect(sources().length).toBeGreaterThan(0);
  });

  for (const { pattern, why } of FORBIDDEN) {
    it(`uses no ${pattern.source} — ${why}`, () => {
      const hits = sources()
        .filter((s) => pattern.test(s.code))
        .map((s) => s.file);
      expect(hits).toEqual([]);
    });
  }

  it("takes no engagement input that identifies whose engagement it is", () => {
    const interest = readFileSync(path.join(DIR, "interest.ts"), "utf8");
    // ProfileEngagement carries a showId and a type, never a user
    expect(stripComments(interest)).toMatch(
      /ProfileEngagement\s*=\s*\{\s*showId:\s*string;\s*type:\s*EngagementType;?\s*\}/,
    );
  });
});
