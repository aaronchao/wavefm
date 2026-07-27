import { l2Normalize } from "@/src/core/recommend/vectorize";
import type { ParsedDiscussion, TagWeights, WavrCandidate } from "@/src/core/wavr";

/** Build an L2-normalized tag vector from plain weights. */
export function tags(weights: Record<string, number>): TagWeights {
  return l2Normalize(weights);
}

export function discussion(
  over: Partial<ParsedDiscussion> & { tags: TagWeights },
): ParsedDiscussion {
  return {
    quote: { source: "r/podcasts", text: "worth every minute" },
    sentiment: 0.6,
    intent: "recommendation",
    ...over,
  };
}

let n = 0;

export function candidate(over: Partial<WavrCandidate> = {}): WavrCandidate {
  n += 1;
  return {
    episodeId: `e${n}`,
    showId: `s${n}`,
    title: `Episode ${n}`,
    showTitle: `Show ${n}`,
    audioUrl: `https://cdn/${n}.mp3`,
    discussions: [discussion({ tags: tags({ psychology: 1 }) })],
    ...over,
  };
}

/** Deterministic id counter reset, so test order can't change fixtures. */
export function resetIds() {
  n = 0;
}
