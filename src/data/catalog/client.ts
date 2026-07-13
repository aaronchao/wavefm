import type {
  CatalogSearchResponse,
  CatalogShow,
  CatalogShowResponse,
  SimilarResponse,
} from "./types";

/** Browser-side typed client for /api/catalog/*. Failures degrade, never throw. */

export async function searchShows(q: string): Promise<CatalogSearchResponse> {
  try {
    const res = await fetch(`/api/catalog/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) return { shows: [], degraded: true };
    return (await res.json()) as CatalogSearchResponse;
  } catch {
    return { shows: [], degraded: true };
  }
}

export async function getShow(id: string): Promise<CatalogShow | null> {
  try {
    const res = await fetch(`/api/catalog/show?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const json = (await res.json()) as CatalogShowResponse;
    return json.show;
  } catch {
    return null;
  }
}

export async function getSimilar(id: string): Promise<SimilarResponse> {
  try {
    const res = await fetch(`/api/catalog/similar?id=${encodeURIComponent(id)}`);
    if (!res.ok) return { shows: [], episodes: [], degraded: true };
    return (await res.json()) as SimilarResponse;
  } catch {
    return { shows: [], episodes: [], degraded: true };
  }
}
