/**
 * Wavr deck engine — pure, deterministic, no React/Next imports.
 * Design: docs/wavr-route-design.md §8.
 */
export type {
  ParsedDiscussion,
  TagWeights,
  WavrCandidate,
  WavrCard,
} from "./types";
export { interestProfile, type ProfileEngagement } from "./interest";
export {
  buildWhy,
  matchDiscussion,
  scoreCandidate,
  MIN_MATCH,
  type CandidateMatch,
} from "./match";
export { buildDeck, type DeckOptions } from "./deck";
export { parseDiscussion } from "./parse";
export {
  commitDistance,
  decideSwipe,
  SWIPE,
  type SwipeInput,
  type SwipeOutcome,
} from "./swipe";
export { scrubTarget, SCRUB_STEP, type ScrubInput } from "./scrub";
export {
  seedFromId,
  wavrClipStart,
  WAVR_CLIP_SEC,
  WAVR_INTRO_SKIP_SEC,
  WAVR_PLAYBACK_RATE,
} from "./clip";
export {
  deckReducer,
  initialDeckState,
  type Decision,
  type DeckAction,
  type DeckMode,
  type DeckState,
  type Undoable,
} from "./deckReducer";
