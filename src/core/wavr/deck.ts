import { buildWhy, scoreCandidate } from "./match";
import type { TagWeights, WavrCandidate, WavrCard } from "./types";

export type DeckOptions = {
  /** Max cards from one show per deck (default 2). */
  maxPerShow?: number;
  /** Max share of the deck any one primary tag may hold (default 0.6). */
  dominantTagCap?: number;
  /** How many leading slots are reserved for cards that have audio. */
  audioFirstSlots?: number;
  /** Hard cap on deck length. */
  limit?: number;
};

const DEFAULTS = {
  maxPerShow: 2,
  dominantTagCap: 0.6,
  audioFirstSlots: 6,
  limit: 40,
} as const;

/**
 * Order and diversify scored candidates into a deck.
 *
 * Fully deterministic — same inputs produce a byte-identical deck, every
 * tie broken explicitly. A deck that reshuffles between renders would make
 * the "swipe" contract meaningless.
 *
 * Pipeline: score/drop -> sort -> per-show cap -> demote a dominant tag ->
 * reserve the opening slots for playable cards -> break up runs of the same
 * show -> truncate.
 */
export function buildDeck(
  candidates: WavrCandidate[],
  profile: TagWeights,
  opts: DeckOptions = {},
): WavrCard[] {
  const maxPerShow = opts.maxPerShow ?? DEFAULTS.maxPerShow;
  const dominantTagCap = opts.dominantTagCap ?? DEFAULTS.dominantTagCap;
  const audioFirstSlots = opts.audioFirstSlots ?? DEFAULTS.audioFirstSlots;
  const limit = opts.limit ?? DEFAULTS.limit;

  const scored: WavrCard[] = [];
  for (const c of candidates) {
    const match = scoreCandidate(profile, c);
    if (!match) continue; // no honest reason to show it
    scored.push({
      id: `${c.showId}:${c.episodeId}`,
      episodeId: c.episodeId,
      showId: c.showId,
      title: c.title,
      showTitle: c.showTitle,
      coverUrl: c.coverUrl,
      audioUrl: c.audioUrl,
      durationSec: c.durationSec,
      appleUrl: c.appleUrl,
      quote: match.quote,
      matchedTags: match.matchedTags,
      why: buildWhy(match.matchedTags, match.quote),
      score: match.score,
    });
  }

  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const capped = capPerShow(scored, maxPerShow);
  const balanced = demoteDominantTag(capped, dominantTagCap);
  const playableFirst = reserveAudioSlots(balanced, audioFirstSlots);
  return breakUpRuns(playableFirst).slice(0, limit);
}

/** Keep at most `max` cards per show, highest-scoring first. */
function capPerShow(cards: WavrCard[], max: number): WavrCard[] {
  const seen = new Map<string, number>();
  const out: WavrCard[] = [];
  for (const c of cards) {
    const n = seen.get(c.showId) ?? 0;
    if (n >= max) continue;
    seen.set(c.showId, n + 1);
    out.push(c);
  }
  return out;
}

/**
 * Stop one topic from eating the deck. Overflow is DEMOTED to the back, not
 * dropped — the user still gets the cards, just not six of them in a row.
 */
function demoteDominantTag(cards: WavrCard[], cap: number): WavrCard[] {
  const maxPerTag = Math.max(1, Math.floor(cards.length * cap));
  const used = new Map<string, number>();
  const kept: WavrCard[] = [];
  const overflow: WavrCard[] = [];
  for (const c of cards) {
    const tag = c.matchedTags[0];
    if (tag === undefined) {
      kept.push(c);
      continue;
    }
    const n = used.get(tag) ?? 0;
    if (n >= maxPerTag) {
      overflow.push(c);
      continue;
    }
    used.set(tag, n + 1);
    kept.push(c);
  }
  return [...kept, ...overflow];
}

/**
 * The opening cards should be playable — Wavr is a listen-then-decide
 * surface. Cards without audio stay in the deck, just not in the first
 * `slots` positions (when there are enough playable ones to fill them).
 */
function reserveAudioSlots(cards: WavrCard[], slots: number): WavrCard[] {
  if (slots <= 0) return cards;
  const head: WavrCard[] = [];
  const rest: WavrCard[] = [];
  for (const c of cards) {
    if (head.length < slots && c.audioUrl) head.push(c);
    else rest.push(c);
  }
  return [...head, ...rest];
}

/**
 * No two consecutive cards from the same show. Pulls the nearest later card
 * from a different show forward, which preserves score order as far as it
 * can; if no such card exists the run is left alone rather than dropped.
 */
function breakUpRuns(cards: WavrCard[]): WavrCard[] {
  const out = [...cards];
  for (let i = 1; i < out.length; i++) {
    if (out[i].showId !== out[i - 1].showId) continue;
    const swap = out.findIndex((c, j) => j > i && c.showId !== out[i - 1].showId);
    if (swap === -1) break; // everything left is the same show
    const [picked] = out.splice(swap, 1);
    out.splice(i, 0, picked);
  }
  return out;
}
