/**
 * Fractional-rank helpers for the Queue's drag-to-reorder (REFINEMENTS.md
 * #1/#3): moving an item only ever touches its own row — never a full-list
 * reindex — by ranking it relative to its new neighbors (same pattern as
 * Trello/Notion). PURE: no I/O, no React/Next imports.
 */

const GAP = 1;

/** Rank that sorts before every rank currently in the queue. */
export function rankAtTop(existingRanks: number[]): number {
  return existingRanks.length ? Math.min(...existingRanks) - GAP : 0;
}

/** Rank that sorts after every rank currently in the queue. */
export function rankAtBottom(existingRanks: number[]): number {
  return existingRanks.length ? Math.max(...existingRanks) + GAP : 0;
}

/**
 * Rank for dropping between two ordered neighbors. Either may be absent at
 * a list edge (drop above the first item / below the last item).
 */
export function rankBetween(before: number | null, after: number | null): number {
  if (before == null && after == null) return 0;
  if (before == null) return after! - GAP;
  if (after == null) return before + GAP;
  return (before + after) / 2;
}
