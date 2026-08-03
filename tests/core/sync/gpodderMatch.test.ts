import { describe, expect, it } from "vitest";
import { matchGpodderActions, statusForGpodderPosition } from "@/src/core/sync/gpodderMatch";

describe("statusForGpodderPosition", () => {
  it("is in_progress below 90% of total", () => {
    expect(statusForGpodderPosition(500, 1000)).toBe("in_progress");
  });
  it("is finished at or above 90% of total", () => {
    expect(statusForGpodderPosition(900, 1000)).toBe("finished");
    expect(statusForGpodderPosition(1000, 1000)).toBe("finished");
  });
  it("is in_progress when total is unknown", () => {
    expect(statusForGpodderPosition(900, undefined)).toBe("in_progress");
  });
});

describe("matchGpodderActions", () => {
  it("matches by exact audio URL and reports the resulting status", () => {
    const updates = matchGpodderActions(
      [{ audioUrl: "https://cdn/a.mp3", positionSec: 950, totalSec: 1000 }],
      [{ episodeId: "e1", audioUrl: "https://cdn/a.mp3" }],
    );
    expect(updates).toEqual([{ episodeId: "e1", status: "finished", positionSec: 950 }]);
  });

  it("skips episodes with no matching action", () => {
    const updates = matchGpodderActions(
      [{ audioUrl: "https://cdn/other.mp3", positionSec: 10 }],
      [{ episodeId: "e1", audioUrl: "https://cdn/a.mp3" }],
    );
    expect(updates).toEqual([]);
  });

  it("skips episodes with no audio URL at all", () => {
    const updates = matchGpodderActions(
      [{ audioUrl: "https://cdn/a.mp3", positionSec: 10 }],
      [{ episodeId: "e1" }],
    );
    expect(updates).toEqual([]);
  });

  it("the later action wins when the same URL appears twice (chronological input)", () => {
    const updates = matchGpodderActions(
      [
        { audioUrl: "https://cdn/a.mp3", positionSec: 100 },
        { audioUrl: "https://cdn/a.mp3", positionSec: 800 },
      ],
      [{ episodeId: "e1", audioUrl: "https://cdn/a.mp3" }],
    );
    expect(updates).toEqual([{ episodeId: "e1", status: "in_progress", positionSec: 800 }]);
  });
});
