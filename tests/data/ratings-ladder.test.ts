import { describe, expect, it } from "vitest";
import { runLadder } from "@/src/data/ratings/ladder";

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
