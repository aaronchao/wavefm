import { ENGAGEMENT_WEIGHTS, type EngagementType } from "@/src/core/engagement";
import { tokenize } from "@/src/core/recommend/tokenize";
import { l2Normalize } from "@/src/core/recommend/vectorize";
import type { TagWeights } from "./types";

/** Declared interests count for more than a single incidental engagement. */
const INTEREST_WEIGHT = 2;

export type ProfileEngagement = { showId: string; type: EngagementType };

/**
 * The user's tag vector: their declared interests plus their OWN engagement
 * history. Nobody else's data enters this function — that is the whole point
 * (docs/wavr-route-design.md §8.1).
 *
 * A `block` (-3) subtracts from the tags of the show that was blocked, so
 * skipping steers the deck away from a topic. Tags that end up negative are
 * clamped to 0 rather than allowed to flip: a disliked tag should stop
 * attracting cards, not start attracting their opposite (which is meaningless
 * in a bag-of-tags space).
 *
 * Deterministic: same inputs -> same vector.
 */
export function interestProfile(
  interests: string[],
  engagements: ProfileEngagement[],
  showTags: Record<string, string[]>,
): TagWeights {
  const acc: Record<string, number> = {};

  for (const interest of interests) {
    for (const t of tokenize(interest)) {
      acc[t] = (acc[t] ?? 0) + INTEREST_WEIGHT;
    }
  }

  for (const e of engagements) {
    const tags = showTags[e.showId];
    if (!tags) continue;
    const w = ENGAGEMENT_WEIGHTS[e.type];
    for (const tag of tags) {
      for (const t of tokenize(tag)) {
        acc[t] = (acc[t] ?? 0) + w;
      }
    }
  }

  const clamped: Record<string, number> = {};
  for (const term in acc) {
    if (acc[term] > 0) clamped[term] = acc[term];
  }
  return l2Normalize(clamped);
}
