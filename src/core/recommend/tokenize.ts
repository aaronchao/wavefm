const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with",
  "is", "are", "this", "that", "from", "by", "at", "it", "its", "as",
  "how", "what", "why", "you", "your", "we", "our", "us", "he", "she",
  "they", "them", "his", "her", "their", "will", "can", "all", "each",
  "podcast", "podcasts", "show", "shows", "episode", "episodes",
  "weekly", "new", "every", "about", "more", "listen", "host", "hosted",
]);

/**
 * Lowercased latin words minus stopwords, plus CJK characters and
 * character bigrams (Chinese/Japanese titles have no word boundaries).
 * Deterministic: same text -> same token list.
 */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const lower = text.toLowerCase();
  for (const m of lower.matchAll(/[a-z0-9]+(?:'[a-z]+)?/g)) {
    const w = m[0];
    if (w.length > 1 && !STOPWORDS.has(w)) tokens.push(w);
  }
  for (const run of lower.match(/[぀-ヿ一-鿿]+/g) ?? []) {
    for (let i = 0; i < run.length; i++) {
      tokens.push(run[i]);
      if (i + 1 < run.length) tokens.push(run.slice(i, i + 2));
    }
  }
  return tokens;
}
