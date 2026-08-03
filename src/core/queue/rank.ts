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

/**
 * Rank for a one-step ▲/▼ move (swaps the item with its adjacent
 * neighbor). `ranks` is the full ordered queue; `index` is the moving
 * item's current position. Null at either edge — nothing to swap with.
 */
export function rankAfterAdjacentMove(
  ranks: number[],
  index: number,
  direction: "up" | "down",
): number | null {
  if (direction === "up" && index <= 0) return null;
  if (direction === "down" && index >= ranks.length - 1) return null;
  const without = ranks.filter((_, i) => i !== index);
  const insertPos = direction === "up" ? index - 1 : index + 1;
  const before = insertPos > 0 ? without[insertPos - 1] : null;
  const after = insertPos < without.length ? without[insertPos] : null;
  return rankBetween(before, after);
}

/**
 * Rank for dropping at an arbitrary index (drag-and-drop, not just an
 * adjacent swap) — `ranks` must already exclude the item being moved (it's
 * either not in the queue yet, or was filtered out before computing where
 * it landed). `index` 0 means "before everything," `ranks.length` means
 * "after everything."
 */
export function rankForIndex(ranks: number[], index: number): number {
  const before = index > 0 ? ranks[index - 1] : null;
  const after = index < ranks.length ? ranks[index] : null;
  return rankBetween(before, after);
}
