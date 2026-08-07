/**
 * When each episode was last handed off to an external player.
 *
 * Feeds the auto-retire heuristic (src/core/library/autoRetire.ts): WaveFM
 * can't be told when Pocket Casts finishes an episode, but it does know when
 * it sent one there, and roughly how long it runs.
 *
 * DELIBERATELY localStorage, not Supabase. Persisting this properly would
 * mean an `opened_at` column, i.e. a migration against the live database —
 * not something to apply unattended. Device-local is also a reasonable fit
 * for the signal itself: you hand an episode off from the device you're
 * holding, and that's the device that then infers you finished it. The
 * limitation is real though — hand off on your phone and the desktop won't
 * retire it. A column + cross-device sync is the follow-up.
 */

const KEY = "wavr.handoffs.v1";
/** Old entries are useless once acted on; keeps the blob from growing forever. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type HandoffMap = Record<string, string>; // episodeId -> ISO timestamp

function read(): HandoffMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    // Values arrive from storage, so validate rather than trusting the shape.
    const out: HandoffMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" && !Number.isNaN(Date.parse(v))) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function write(map: HandoffMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // private mode / quota — the heuristic just won't fire, which is safe
  }
}

/** Note that this episode was just opened in an external player. */
export function recordHandoff(episodeId: string, at = new Date()): void {
  if (typeof localStorage === "undefined") return;
  const map = read();
  map[episodeId] = at.toISOString();
  const cutoff = at.getTime() - MAX_AGE_MS;
  for (const [id, iso] of Object.entries(map)) {
    if (Date.parse(iso) < cutoff) delete map[id];
  }
  write(map);
}

/** All known handoffs, episodeId -> ISO timestamp. */
export function listHandoffs(): HandoffMap {
  if (typeof localStorage === "undefined") return {};
  return read();
}

/** Forget a handoff — called once its episode has been acted on. */
export function clearHandoff(episodeId: string): void {
  if (typeof localStorage === "undefined") return;
  const map = read();
  if (map[episodeId]) {
    delete map[episodeId];
    write(map);
  }
}
