/**
 * A log of every episode handed off to an external player.
 *
 * `handoffRepo` answers "is this one due to be retired?" and forgets an entry
 * the moment it acts on it. That's the wrong shape for history: the useful
 * record is precisely the ones already dealt with. This keeps the log, so
 * WaveFM can answer "what have I actually sent off to listen to?" — the
 * whole point of it being the central place when playback happens elsewhere.
 *
 * localStorage, same as handoffRepo and for the same reason: persisting it
 * properly means a table plus a migration against the live database. Noted
 * as a follow-up; the device-local version is genuinely useful in the
 * meantime, since you hand off from the device in your hand.
 */

const KEY = "wavr.listenHistory.v1";
/** Newest-first, capped — this is a recent-activity log, not an archive. */
const MAX_ENTRIES = 200;

export type HistoryEntry = {
  episodeId: string;
  title: string;
  showTitle?: string;
  coverUrl?: string;
  /** When it was opened in an external player (ISO). */
  openedAt: string;
  /** Set when auto-retire (or the user) marked it finished (ISO). */
  finishedAt?: string;
  /** True when auto-retire inferred it rather than the user saying so. */
  inferred?: boolean;
};

function read(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Came from storage, so validate rather than trusting the shape.
    return parsed.filter(
      (e): e is HistoryEntry =>
        Boolean(e) &&
        typeof e === "object" &&
        typeof (e as HistoryEntry).episodeId === "string" &&
        typeof (e as HistoryEntry).title === "string" &&
        typeof (e as HistoryEntry).openedAt === "string" &&
        !Number.isNaN(Date.parse((e as HistoryEntry).openedAt)),
    );
  } catch {
    return [];
  }
}

function write(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // private mode / quota — history is a convenience, never load-bearing
  }
}

/**
 * Record a handoff. Re-opening the same episode moves it back to the top and
 * clears any previous finish, rather than adding a duplicate row — the
 * question this answers is "when did I last send this off?".
 */
export function logHandoff(entry: Omit<HistoryEntry, "finishedAt" | "inferred">): void {
  if (typeof localStorage === "undefined") return;
  const rest = read().filter((e) => e.episodeId !== entry.episodeId);
  write([{ ...entry }, ...rest]);
}

/** Mark a logged episode finished. No-op if it was never handed off. */
export function logFinished(episodeId: string, inferred: boolean, at = new Date()): void {
  if (typeof localStorage === "undefined") return;
  const entries = read();
  const i = entries.findIndex((e) => e.episodeId === episodeId);
  if (i === -1) return;
  entries[i] = { ...entries[i], finishedAt: at.toISOString(), inferred };
  write(entries);
}

/** Newest first. */
export function listHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  return read().sort((a, b) => b.openedAt.localeCompare(a.openedAt));
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  write([]);
}
