import { hasRecIntentTitle } from "@/src/core/mining/intent";
import { normalize } from "@/src/core/mining/normalize";
import { sentimentOf } from "@/src/core/mining/sentiment";
import type { EdgeEvidence, Intent } from "@/src/core/mining/types";
import { tokenize } from "@/src/core/recommend/tokenize";
import { l2Normalize } from "@/src/core/recommend/vectorize";
import type { ParsedDiscussion, TagWeights } from "./types";

/**
 * Turns a citable quote into the tags/sentiment/intent triple `match.ts`
 * needs (docs/wavr-route-design.md §8.1's permitted signal 3). PURE, reusing
 * the same NLP primitives the mining pipeline already ships: tags are a
 * bag-of-words over the quote and the show's own categories, sentiment comes
 * from the bilingual lexicon, and "recommendation" intent is detected the
 * same way a rec-seeking thread title is (§ mining/intent.ts) rather than
 * invented separately for Wavr.
 */
export function parseDiscussion(
  quote: EdgeEvidence,
  contextTags: string[] = [],
): ParsedDiscussion {
  const tags = tagsFromText(quote.text, contextTags.join(" "));
  const sentiment = sentimentOf(quote.text);
  const intent: Intent = hasRecIntentTitle(normalize(quote.text))
    ? "recommendation"
    : "comention";
  return { quote, tags, sentiment, intent };
}

function tagsFromText(...texts: string[]): TagWeights {
  const acc: Record<string, number> = {};
  for (const text of texts) {
    for (const t of tokenize(text)) acc[t] = (acc[t] ?? 0) + 1;
  }
  return l2Normalize(acc);
}
