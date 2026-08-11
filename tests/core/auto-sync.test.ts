import { describe, expect, it } from "vitest";
import { AUTO_SYNC_MIN_INTERVAL_MS, shouldAutoSync } from "@/src/core/library/autoSync";

const NOW = Date.parse("2026-08-08T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const HOUR = 3600_000;

describe("shouldAutoSync", () => {
  it("is false with no Pocket Casts connection, regardless of last sync", () => {
    expect(shouldAutoSync(false, null, NOW)).toBe(false);
    expect(shouldAutoSync(false, ago(100 * HOUR), NOW)).toBe(false);
  });

  it("is true when connected and never synced before", () => {
    expect(shouldAutoSync(true, null, NOW)).toBe(true);
    expect(shouldAutoSync(true, undefined, NOW)).toBe(true);
  });

  it("is false inside the throttle window", () => {
    expect(shouldAutoSync(true, ago(HOUR), NOW)).toBe(false);
    expect(shouldAutoSync(true, ago(AUTO_SYNC_MIN_INTERVAL_MS - 1000), NOW)).toBe(false);
  });

  it("is true once the throttle window has passed", () => {
    expect(shouldAutoSync(true, ago(AUTO_SYNC_MIN_INTERVAL_MS), NOW)).toBe(true);
    expect(shouldAutoSync(true, ago(AUTO_SYNC_MIN_INTERVAL_MS + 1000), NOW)).toBe(true);
  });

  it("treats an unparseable timestamp as due, rather than never syncing again", () => {
    expect(shouldAutoSync(true, "not a date", NOW)).toBe(true);
  });
});
