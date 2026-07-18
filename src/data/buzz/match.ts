/**
 * Normalize a show title for cross-source matching (buzz providers).
 * Lowercase, strip punctuation, drop podcast-y suffix words, collapse
 * whitespace — so "Show — The Podcast" matches "Show". CJK is preserved.
 * Pure + deterministic.
 */
export function normalizeForMatch(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\b(podcast|podcasts|radio|fm)\b/g, " ")
    .replace(/播客|电台|广播/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+(the|a|an)$/, ""); // drop an article left dangling by suffix removal
}

/** True when two titles match after normalization (empty never matches). */
export function titlesMatch(a: string, b: string): boolean {
  const na = normalizeForMatch(a);
  return na.length > 0 && na === normalizeForMatch(b);
}
