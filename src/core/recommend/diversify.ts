import type { Cluster } from "./types";

export type DiversifyCaps = {
  /** Max shows per cluster (default 5) — the feed must not collapse. */
  perCluster?: number;
  /** Max clusters returned (default 8). */
  maxClusters?: number;
};

/**
 * Sorts items within clusters by score, caps each cluster, drops empty
 * clusters, and orders clusters by their best item. Deterministic:
 * ties break by show id / cluster id.
 */
export function diversify(clusters: Cluster[], caps: DiversifyCaps = {}): Cluster[] {
  const perCluster = caps.perCluster ?? 5;
  const maxClusters = caps.maxClusters ?? 8;

  const trimmed = clusters
    .map((c) => ({
      ...c,
      items: [...c.items]
        .sort((a, b) => b.score - a.score || a.show.id.localeCompare(b.show.id))
        .slice(0, perCluster),
    }))
    .filter((c) => c.items.length > 0);

  return trimmed
    .sort(
      (a, b) =>
        b.items[0].score - a.items[0].score || a.id.localeCompare(b.id),
    )
    .slice(0, maxClusters);
}
