import type { WavrCard } from "@/src/core/wavr";

/** Response of GET /api/wavr/feed (docs/wavr-route-design.md §8.3). */
export type WavrFeedResponse = {
  cards: WavrCard[];
  cursor: string | null;
  /** True only when every rung of the source ladder failed. */
  degraded: boolean;
};
