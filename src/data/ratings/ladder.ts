/**
 * The Section 7 fallback ladder: try each rung in order, return the first
 * non-null rating, swallow every failure. NEVER throws to the caller.
 */

export type Rung = () => Promise<number | null>;

export async function runLadder(rungs: Rung[]): Promise<number | null> {
  for (const rung of rungs) {
    try {
      const rating = await rung();
      if (rating !== null && Number.isFinite(rating)) return rating;
    } catch {
      // rung failed — fall through to the next one
    }
  }
  return null;
}

/** fetch with a hard timeout; good-citizen defaults for scraping rungs. */
export async function fetchWithTimeout(
  url: string,
  ms = 4000,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": "wavr/0.1 (personal podcast discovery; low volume)",
        ...init.headers,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}
