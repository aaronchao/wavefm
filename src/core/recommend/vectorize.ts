import { tokenize } from "./tokenize";
import type { ShowInput, SparseVector } from "./types";

/** Structured fields say more about a show's topic than prose does. */
const FIELD_WEIGHTS = {
  title: 2,
  description: 1,
  categories: 3,
  clusterTags: 3,
} as const;

export function l2Normalize(v: SparseVector): SparseVector {
  let sum = 0;
  for (const k in v) sum += v[k] * v[k];
  if (sum === 0) return {};
  const norm = Math.sqrt(sum);
  const out: SparseVector = {};
  for (const k in v) out[k] = v[k] / norm;
  return out;
}

function addTokens(acc: SparseVector, text: string, weight: number) {
  for (const t of tokenize(text)) acc[t] = (acc[t] ?? 0) + weight;
}

/** Field-weighted term frequencies (unnormalized, no idf). */
export function termWeights(show: ShowInput): SparseVector {
  const acc: SparseVector = {};
  addTokens(acc, show.title, FIELD_WEIGHTS.title);
  if (show.description) addTokens(acc, show.description, FIELD_WEIGHTS.description);
  for (const c of show.categories) addTokens(acc, c, FIELD_WEIGHTS.categories);
  for (const t of show.clusterTags ?? []) addTokens(acc, t, FIELD_WEIGHTS.clusterTags);
  return acc;
}

/**
 * Inverse document frequency over a corpus of shows. Terms every show
 * shares ("interview", "conversation") stop dominating similarity.
 */
export function buildIdf(shows: ShowInput[]): SparseVector {
  const df: SparseVector = {};
  for (const show of shows) {
    for (const term in termWeights(show)) df[term] = (df[term] ?? 0) + 1;
  }
  const n = shows.length;
  const idf: SparseVector = {};
  for (const term in df) idf[term] = Math.log((n + 1) / (df[term] + 1)) + 1;
  return idf;
}

/** TF-IDF vector, L2-normalized (so cosine is a plain dot product). */
export function vectorizeShow(show: ShowInput, idf?: SparseVector): SparseVector {
  const tf = termWeights(show);
  if (idf) {
    for (const term in tf) tf[term] *= idf[term] ?? 1;
  }
  return l2Normalize(tf);
}
