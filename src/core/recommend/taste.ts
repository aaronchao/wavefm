import { ENGAGEMENT_WEIGHTS } from "@/src/core/engagement";
import { tokenize } from "./tokenize";
import { l2Normalize } from "./vectorize";
import type { EngagementInput, SparseVector } from "./types";

const INTEREST_TOKEN_WEIGHT = 2;

/**
 * Taste = weighted sum of engaged shows' vectors (weights from Section 5)
 * plus onboarding interest picks, L2-normalized. Deterministic.
 */
export function tasteVector(
  engagements: EngagementInput[],
  showVectors: Record<string, SparseVector>,
  interests: string[] = [],
): SparseVector {
  const acc: SparseVector = {};
  for (const e of engagements) {
    const vec = showVectors[e.showId];
    if (!vec) continue;
    const w = ENGAGEMENT_WEIGHTS[e.type];
    for (const term in vec) acc[term] = (acc[term] ?? 0) + w * vec[term];
  }
  for (const interest of interests) {
    for (const t of tokenize(interest)) {
      acc[t] = (acc[t] ?? 0) + INTEREST_TOKEN_WEIGHT;
    }
  }
  return l2Normalize(acc);
}
