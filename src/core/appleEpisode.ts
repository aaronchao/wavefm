/**
 * Matching an episode we already hold to Apple's own episode page — the
 * one-click "open the exact episode" link (PURE: no I/O).
 *
 * Why Apple and not Pocket Casts: `pca.st/itunes/<id>` only ever resolves
 * to the SHOW, which is the "still landing on the show page" complaint.
 * Pocket Casts *does* have real episode links (`pca.st/episode/<uuid>`,
 * verified), but the uuid needs two undocumented API hops
 * (pca.st redirect -> podcast uuid -> podcast-api.pocketcasts.com), so it
 * would break silently whenever they change. Apple's Lookup API is free,
 * keyless, documented, already used by this app, and returns per-episode
 * `trackViewUrl` — a real deep link.
 *
 * The match is EXACT, not fuzzy: Apple's `episodeUrl` is the audio
 * enclosure URL, which is the same value we store as an episode's
 * `audioUrl`. Title matching is only a last resort, because episode titles
 * are routinely reused across seasons ("Episode 1") and rewritten in feeds.
 */

export type AppleEpisodeCandidate = {
  /** Apple's episode page URL (`...?i=<trackId>`). */
  trackViewUrl?: string;
  /** The audio enclosure URL Apple has for this episode. */
  episodeUrl?: string;
  trackName?: string;
};

/**
 * Enclosure URLs pick up per-listener prefixes and tracking query strings
 * (podtrac, chartable, pscrb.fm, ...) that differ between Apple's copy and
 * a feed's, so compare on a normalised form: drop the scheme, any leading
 * chain of `host/redirect/...` prefix segments, and the query/fragment.
 */
export function normalizeAudioUrl(url: string): string {
  let s = url.trim();
  s = s.replace(/[?#].*$/, "");
  s = s.replace(/^https?:\/\//i, "");
  // Peel known redirect wrappers: everything up to the LAST embedded host.
  const lastHost = s.lastIndexOf("://");
  if (lastHost !== -1) s = s.slice(lastHost + 3);
  return s.replace(/^www\./i, "").replace(/\/+$/, "").toLowerCase();
}

/** Loose title key — case, punctuation and episode-number noise removed. */
export function titleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9一-鿿]+/g, " ")
    .trim();
}

/**
 * The Apple episode page for this episode, or null when nothing matches
 * confidently. A wrong deep link is worse than none — it silently sends
 * the listener to another episode — so anything short of an exact audio-URL
 * match, or an unambiguous single title hit, returns null.
 */
export function matchAppleEpisode(
  candidates: AppleEpisodeCandidate[],
  episode: { audioUrl?: string; title: string },
): string | null {
  const usable = candidates.filter((c) => c.trackViewUrl);

  if (episode.audioUrl) {
    const want = normalizeAudioUrl(episode.audioUrl);
    const hit = usable.find(
      (c) => c.episodeUrl && normalizeAudioUrl(c.episodeUrl) === want,
    );
    if (hit) return hit.trackViewUrl!;
  }

  const key = titleKey(episode.title);
  if (!key) return null;
  const titleHits = usable.filter((c) => c.trackName && titleKey(c.trackName) === key);
  // Exactly one — two episodes sharing a title means we can't tell them apart.
  return titleHits.length === 1 ? titleHits[0].trackViewUrl! : null;
}
