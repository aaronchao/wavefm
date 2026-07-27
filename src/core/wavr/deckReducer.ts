import type { WavrCard } from "./types";

/**
 * The deck's state machine. PURE — no React import — so it is unit-tested
 * directly and `useSwipeDeck` (src/features/wavr) is a thin `useReducer`
 * wrapper that adds the side-effects (docs/wavr-route-design.md §4.1).
 */

export type Decision = "save" | "skip";
export type DeckMode = "deck" | "overview";

export type Undoable = { card: WavrCard; decision: Decision; at: number };

export type DeckState = {
  /** Pending cards in presentation order. Mutated ONLY by `jump` (a reorder). */
  queue: WavrCard[];
  index: number;
  mode: DeckMode;
  /** Candidate index while long-press scrubbing; null outside overview. */
  scrubIndex: number | null;
  /** Append-only, for undo + telemetry. */
  decided: { card: WavrCard; decision: Decision }[];
  undoable: Undoable | null;
  /** Card mid-exit; index does not advance until `flownOut`. */
  flying: { id: string; dir: -1 | 1 } | null;
};

export type DeckAction =
  | { t: "decide"; card: WavrCard; decision: Decision; dir: -1 | 1 }
  | { t: "flownOut" }
  | { t: "undo" }
  | { t: "expireUndo" }
  | { t: "append"; cards: WavrCard[] }
  | { t: "openOverview" }
  | { t: "scrub"; to: number }
  | { t: "jump"; to: number }
  | { t: "closeOverview" }
  | { t: "reset" };

export function initialDeckState(queue: WavrCard[] = []): DeckState {
  return { queue, index: 0, mode: "deck", scrubIndex: null, decided: [], undoable: null, flying: null };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(n, hi));
}

export function deckReducer(s: DeckState, a: DeckAction): DeckState {
  switch (a.t) {
    case "decide":
      return {
        ...s,
        decided: [...s.decided, { card: a.card, decision: a.decision }],
        undoable: { card: a.card, decision: a.decision, at: Date.now() },
        flying: { id: a.card.id, dir: a.dir },
      };

    case "flownOut":
      if (!s.flying) return s;
      return { ...s, index: s.index + 1, flying: null };

    case "undo": {
      if (!s.undoable) return s;
      // If the exit animation hasn't finished, `index` was never bumped for
      // this card — undoing must not double-decrement.
      const stillFlying = s.flying?.id === s.undoable.card.id;
      return {
        ...s,
        index: stillFlying ? s.index : Math.max(0, s.index - 1),
        decided: s.decided.slice(0, -1),
        undoable: null,
        flying: null,
      };
    }

    case "expireUndo":
      return { ...s, undoable: null };

    case "append":
      return { ...s, queue: [...s.queue, ...a.cards] };

    case "openOverview":
      return { ...s, mode: "overview", scrubIndex: s.index };

    case "scrub":
      if (s.mode !== "overview" || s.queue.length === 0) return s;
      return { ...s, scrubIndex: clamp(a.to, 0, s.queue.length - 1) };

    case "jump": {
      // A REORDER, never a decision — undoable/decided/flying are untouched,
      // so undo still targets the last real decision (§14 assumption 10).
      if (s.queue.length === 0) return { ...s, mode: "deck", scrubIndex: null };
      const to = clamp(a.to, 0, s.queue.length - 1);
      const q = [...s.queue];
      const [picked] = q.splice(to, 1);
      q.splice(s.index, 0, picked);
      return { ...s, queue: q, mode: "deck", scrubIndex: null };
    }

    case "closeOverview":
      return { ...s, mode: "deck", scrubIndex: null };

    case "reset":
      return initialDeckState();

    default:
      return s;
  }
}
