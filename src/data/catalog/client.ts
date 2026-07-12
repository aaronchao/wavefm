import type {
  CatalogSearchResponse,
  CatalogShow,
  CatalogShowResponse,
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
