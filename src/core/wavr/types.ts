import type { EdgeEvidence, Intent } from "@/src/core/mining/types";

/**
 * Wavr deck types. PURE — no React/Next/DB imports (CLAUDE.md §2).
 *
 * The engine matches the user's OWN interest tags against NLP-parsed
 * community discussion text. There is deliberately no type here that can
 * carry another user's identity or behaviour: no user-item matrix, no
 * neighbourhood, no cross-user co-occurrence. See docs/wavr-route-design.md
 * §8.1 — and tests/core/wavr/no-collab.test.ts, which enforces it.
 */

/**
 * Sparse tag weights, L2-normalized and all >= 0.
 *
 * L2 rather than L1 because `cosine()` from /core/recommend is a bare dot
 * product that is only equal to the cosine when BOTH inputs are L2-normalized.
 */
export type TagWeights = Record<string, number>;

/** One community discussion, already parsed by /core/mining. */
export type ParsedDiscussion = {
  /** The citable quote shown on the card. */
  quote: EdgeEvidence;
  /** Tags parsed out of the quote + thread title. */
  tags: TagWeights;
  /** -1..1, from /core/mining/sentiment. */
  sentiment: number;
  intent: Intent;
};

/** An episode plus the discussion that might justify showing it. */
export type WavrCandidate = {
  episodeId: string;
  showId: string;
  title: string;
  showTitle: string;
  coverUrl?: string;
  audioUrl?: string;
  durationSec?: number;
  appleUrl?: string;
  publishedAt?: string;
  discussions: ParsedDiscussion[];
};

/**
 * A scored, deck-ordered card. The wire type in /src/data adds `clipFraction`
 * (chosen server-side so a card sounds the same across re-renders and undo);
 * core stays free of anything random.
 */
export type WavrCard = {
  /** `${showId}:${episodeId}` — stable dedupe key. */
  id: string;
  episodeId: string;
  showId: string;
  title: string;
  showTitle: string;
  coverUrl?: string;
  audioUrl?: string;
  durationSec?: number;
  appleUrl?: string;
  /** ISO date the episode was published — real catalog metadata, shown on the card. */
  publishedAt?: string;
  /**
   * The community quote that earned this card its slot. Omitted for cards
   * sourced by a plain search on the user's own tags when no real discussion
   * evidence was found (§8.4 — no evidence means no quote, never a fake one).
   */
  quote?: EdgeEvidence;
  /** Profile tags this card matched on, strongest first. */
  matchedTags: string[];
  /** Human reason shown on the card — explainability is the product. */
  why: string;
  score: number;
};
