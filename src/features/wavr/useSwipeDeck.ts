"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { WavrCard } from "@/src/core/wavr";
import {
  deckReducer,
  initialDeckState,
  type Decision,
  type DeckState,
} from "@/src/core/wavr/deckReducer";
import type { CatalogEpisode, CatalogShow } from "@/src/data/catalog/types";
import { recordEngagement } from "@/src/data/repos/engagementRepo";
import { bumpImpressions } from "@/src/data/repos/impressionsRepo";
import { removeEpisode, saveEpisode } from "@/src/data/repos/savedEpisodesRepo";
import { haptic } from "@/src/ui";

/**
 * `useReducer(deckReducer)` plus the decision side-effects (§4.2, §4.3).
 * The reducer itself is pure (src/core/wavr/deckReducer.ts); this hook is
 * the only place that touches repos, so the state machine stays testable
 * without mocking Supabase/localStorage.
 */

/** How long an undo stays available after a decision (§4.3). */
const UNDO_MS = 5000;
/** Fallback if the exit animation never completes — the deck must never wedge (§4.1). */
const FLOWNOUT_GUARD_MS = 600;

function showOf(card: WavrCard): CatalogShow {
  return {
    id: card.showId,
    // Wavr candidates come from the itunes-backed catalog cache; `source`
    // only affects display elsewhere, so a fixed default is harmless.
    source: "itunes",
    title: card.showTitle,
    author: "",
    coverUrl: card.coverUrl,
    appleUrl: card.appleUrl,
    categories: card.matchedTags,
  };
}

function episodeOf(card: WavrCard): CatalogEpisode {
  return {
    id: card.episodeId,
    title: card.title,
    showId: card.showId,
    showTitle: card.showTitle,
    coverUrl: card.coverUrl,
    appleUrl: card.appleUrl,
    audioUrl: card.audioUrl,
    durationSec: card.durationSec,
    categories: card.matchedTags,
  };
}

export type UseSwipeDeck = {
  state: DeckState;
  card: WavrCard | undefined;
  peek: WavrCard[];
  exhausted: boolean;
  decide: (decision: Decision, dir: -1 | 1) => void;
  flownOut: () => void;
  undo: () => void;
  openOverview: () => void;
  closeOverview: () => void;
  scrub: (to: number) => void;
  jump: (to: number) => void;
};

export function useSwipeDeck(cards: WavrCard[]): UseSwipeDeck {
  const [state, dispatch] = useReducer(deckReducer, cards, initialDeckState);
  const queryClient = useQueryClient();
  const seen = useRef(new Set(cards.map((c) => c.id)));

  // New pages append rather than replace, deduped by id.
  useEffect(() => {
    const fresh = cards.filter((c) => !seen.current.has(c.id));
    if (fresh.length === 0) return;
    for (const c of fresh) seen.current.add(c.id);
    dispatch({ t: "append", cards: fresh });
  }, [cards]);

  // A backgrounded tab can suspend the exit animation's onAnimationComplete
  // indefinitely; the deck must never wedge on a flying card.
  useEffect(() => {
    if (!state.flying) return;
    const id = setTimeout(() => dispatch({ t: "flownOut" }), FLOWNOUT_GUARD_MS);
    return () => clearTimeout(id);
  }, [state.flying]);

  useEffect(() => {
    if (!state.undoable) return;
    const id = setTimeout(() => dispatch({ t: "expireUndo" }), UNDO_MS);
    return () => clearTimeout(id);
  }, [state.undoable]);

  const decide = useCallback(
    (decision: Decision, dir: -1 | 1) => {
      const card = state.queue[state.index];
      if (!card || state.flying) return;
      haptic("commit");
      dispatch({ t: "decide", card, decision, dir });
      if (decision === "save") {
        void saveEpisode(episodeOf(card));
        void recordEngagement(showOf(card), "save");
        void queryClient.invalidateQueries({ queryKey: ["saved"] });
        void queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] });
      } else {
        void recordEngagement(showOf(card), "block");
        bumpImpressions([card.showId]);
      }
    },
    [state.queue, state.index, state.flying, queryClient],
  );

  const undo = useCallback(() => {
    const target = state.undoable;
    if (!target) return;
    haptic("undo");
    dispatch({ t: "undo" });
    void removeEpisode(target.card.episodeId);
    if (target.decision === "skip") {
      // Exact reversal of a block isn't worth a delete API; a lone
      // impression (-0.5) is close enough to neutralise the -3.
      void recordEngagement(showOf(target.card), "impression");
    }
    void queryClient.invalidateQueries({ queryKey: ["saved"] });
    void queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] });
  }, [state.undoable, queryClient]);

  const flownOut = useCallback(() => dispatch({ t: "flownOut" }), []);
  const openOverview = useCallback(() => {
    haptic("expand");
    dispatch({ t: "openOverview" });
  }, []);
  const closeOverview = useCallback(() => dispatch({ t: "closeOverview" }), []);
  const scrub = useCallback((to: number) => dispatch({ t: "scrub", to }), []);
  const jump = useCallback((to: number) => {
    haptic("land");
    dispatch({ t: "jump", to });
  }, []);

  return {
    state,
    card: state.queue[state.index],
    peek: state.queue.slice(state.index + 1, state.index + 3),
    exhausted: state.queue.length > 0 && state.index >= state.queue.length,
    decide,
    flownOut,
    undo,
    openOverview,
    closeOverview,
    scrub,
    jump,
  };
}
