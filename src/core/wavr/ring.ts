/**
 * The deck's three-slot audio ring (docs/wavr-route-design.md §5.2). PURE.
 *
 * Three persistent <audio> elements, never remounted. The mapping is simply
 * `slot = cardIndex % 3`, which falls out very nicely:
 *
 *   - prev / cur / next always land on three DIFFERENT slots, so nothing has
 *     to be swapped or reassigned on advance;
 *   - the element that was `cur` automatically becomes `prev` and KEEPS its
 *     src and seek position, which is what makes undo instant;
 *   - the slot freed up (the card two back) is exactly the one to re-prime
 *     for the card ahead.
 *
 * Two slots would force the outgoing element to be re-primed immediately,
 * throwing away the one thing undo needs.
 */

export type RingSlot = 0 | 1 | 2;
export const RING_SIZE = 3;

export type RingRole = "prev" | "cur" | "next";

export type RingAssignment = {
  slot: RingSlot;
  role: RingRole;
  /** Index into the deck, which may be out of range at the ends. */
  cardIndex: number;
  /** True when `cardIndex` addresses a real card. */
  occupied: boolean;
};

function slotOf(cardIndex: number): RingSlot {
  return (((cardIndex % RING_SIZE) + RING_SIZE) % RING_SIZE) as RingSlot;
}

/**
 * Which slot holds which role for a deck position. Returns one entry per
 * role; `occupied` is false at the ends (no previous card on the first, no
 * next card on the last) so callers never index out of the deck.
 */
export function planRing(count: number, index: number): RingAssignment[] {
  const roles: [RingRole, number][] = [
    ["prev", index - 1],
    ["cur", index],
    ["next", index + 1],
  ];
  return roles.map(([role, cardIndex]) => ({
    slot: slotOf(cardIndex),
    role,
    cardIndex,
    occupied: cardIndex >= 0 && cardIndex < count,
  }));
}

/** The slot a given role occupies at `index`. */
export function slotFor(index: number, role: RingRole): RingSlot {
  const offset = role === "prev" ? -1 : role === "next" ? 1 : 0;
  return slotOf(index + offset);
}
