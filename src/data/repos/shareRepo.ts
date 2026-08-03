export type SharedQueueEpisode = {
  id: string;
  title: string;
  showId?: string;
  showTitle?: string;
  coverUrl?: string;
  appleUrl?: string;
  audioUrl?: string;
  durationSec?: number;
};

/** Fetches a public "share your Queue" page's episodes. Null on any
 *  failure or an unknown/disabled token — the page renders a plain
 *  not-found state either way, never an error. */
export async function getSharedQueue(
  token: string,
): Promise<{ episodes: SharedQueueEpisode[] } | null> {
  try {
    const res = await fetch(`/api/share/${token}`);
    if (!res.ok) return null;
    return (await res.json()) as { episodes: SharedQueueEpisode[] };
  } catch {
    return null;
  }
}
