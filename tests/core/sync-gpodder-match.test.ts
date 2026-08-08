import { describe, expect, it } from "vitest";
import { matchGpodderActions } from "@/src/core/sync/gpodderMatch";

describe("matchGpodderActions — normalised URL matching", () => {
  it("matches through a redirect wrapper, which exact equality missed", () => {
    const out = matchGpodderActions(
      [
        {
          audioUrl: "https://dts.podtrac.com/redirect.mp3/https://cdn.example.com/a.mp3?utm=1",
          positionSec: 300,
          totalSec: 600,
        },
      ],
      [{ episodeId: "a", audioUrl: "https://cdn.example.com/a.mp3" }],
    );
    expect(out).toEqual([{ episodeId: "a", status: "in_progress", positionSec: 300 }]);
  });

  it("still finishes when the position passes the threshold", () => {
    const out = matchGpodderActions(
      [{ audioUrl: "https://cdn.example.com/a.mp3", positionSec: 590, totalSec: 600 }],
      [{ episodeId: "a", audioUrl: "https://cdn.example.com/a.mp3" }],
    );
    expect(out[0].status).toBe("finished");
  });
});
