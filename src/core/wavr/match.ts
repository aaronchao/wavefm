import type { Intent } from "@/src/core/mining/types";
import { cosine } from "@/src/core/recommend/score";
import type { ParsedDiscussion, TagWeights, WavrCandidate } from "./types";

/**
 * Matching a candidate against the profile. The score is derived ONLY from
 * tag overlap with NLP-parsed discussion text — never from what other users
 * did (docs/wavr-route-design.md §8.1).
 */

/** Below this, the card has no honest reason to exist and is dropped. */
export const MIN_MATCH = 0.12;

/** "Recommended this" is worth more than "mentioned in the same breath". */
const INTENT_BOOST: Record<Intent, number> = {
  recommendation: 1,
  seed: 0.7,
  comention: 0.5,
};

/** How many tags the card shows as chips. */
const MAX_MATCHED_TAGS = 3;

/**
 * cosine(profile, discussion tags) x intent boost x sentiment gate.
 *
 * The gate maps sentiment -1..1 onto 0..1, so a thread trashing a show
 * scores ~0 and drops out rather than being recommended for being talked
 * about. Popularity is not endorsement.
 */
export function matchDiscussion(profile: TagWeights, d: ParsedDiscussion): number {
  const sim = cosine(profile, d.tags);
  const gate = Math.max(0, Math.min(1, 0.5 + d.sentiment / 2));
  return sim * INTENT_BOOST[d.intent] * gate;
}

export type CandidateMatch = {
  score: number;
  quote: ParsedDiscussion["quote"];
  matchedTags: string[];
};

/**
 * Best-matching discussion wins, and its quote becomes the card's shown
 * reason — so the reason on the card IS the ranking key, not a caption
 * written after the fact.
 *
 * Returns null when nothing clears MIN_MATCH. Deterministic: ties break on
 * the quote text so input order can't change the outcome.
 */
export function scoreCandidate(
  profile: TagWeights,
  candidate: WavrCandidate,
): CandidateMatch | null {
  let best: { d: ParsedDiscussion; score: number } | null = null;
  for (const d of candidate.discussions) {
    const score = matchDiscussion(profile, d);
    if (
      !best ||
      score > best.score ||
      (score === best.score && d.quote.text < best.d.quote.text)
    ) {
      best = { d, score };
    }
  }
  if (!best || best.score < MIN_MATCH) return null;
  return {
    score: best.score,
    quote: best.d.quote,
    matchedTags: overlapTags(profile, best.d.tags),
  };
}

/** Shared tags, strongest contribution first; ties alphabetical. */
function overlapTags(profile: TagWeights, tags: TagWeights): string[] {
  const shared: { tag: string; weight: number }[] = [];
  for (const tag in tags) {
    const p = profile[tag];
    if (p === undefined) continue;
    shared.push({ tag, weight: p * tags[tag] });
  }
  return shared
    .sort((a, b) => b.weight - a.weight || a.tag.localeCompare(b.tag))
    .slice(0, MAX_MATCHED_TAGS)
    .map((s) => s.tag);
}

/**
 * The card's one-line reason. Never claims a number that isn't in the data —
 * if we don't know how many threads there were, we don't say.
 */
export function buildWhy(matchedTags: string[], quote: ParsedDiscussion["quote"]): string {
  const tag = matchedTags[0];
  if (!tag) return "A starting point — tell Wavr what you like to sharpen this";
  if (quote.source) {
    return `Matches your interest in ${tag} — ${quote.source} listeners keep bringing it up`;
  }
  return `Because you follow ${tag}`;
}
