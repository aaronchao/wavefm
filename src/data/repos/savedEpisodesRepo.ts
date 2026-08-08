import { matchGpodderActions } from "@/src/core/sync/gpodderMatch";
import {
  matchPocketCastsHistory,
  newSubscriptions,
  type PocketCastsEpisode,
  type PocketCastsPodcast,
} from "@/src/core/sync/pocketCastsMatch";
import type { CatalogEpisode } from "@/src/data/catalog/types";
import { getSupabase } from "@/src/data/supabase/client";
import { setPocketCastsToken } from "@/src/data/repos/prefsRepo";
import { listSaved, saveShow } from "@/src/data/repos/savedShowsRepo";
import { stableFeedId } from "@/src/core/opml";

/**
 * Listen-later collection: episodes the user liked, with playback status
 * and a resume point. Signed in -> Supabase (syncs across devices);
 * signed out, unconfigured, or table missing -> localStorage. All
 * failures degrade silently, mirroring savedShowsRepo.
 */

const LOCAL_KEY = "wavr.savedEpisodes.v1";

export type EpisodeStatus = "queued" | "in_progress" | "finished";

/**
 * Buckets. Fresh saves land straight in `queue` (ranked by `queueRank`,
 * fractional — see src/core/queue/rank.ts); `archived` is the opt-out.
 *
 * `inbox` is RETIRED and no longer written to. It was a triage step —
 * saves landed untouched and needed a gesture each to commit — but that is
 * inbox-zero chores on a leisure app: the filing work never got done, so
 * the pile stayed a pile. Finding something to play is now handled by
 * surfacing (src/core/library/rightNow.ts), which needs no filing at all.
 * The value stays in the union so pre-existing rows still parse; the
 * Library promotes any it finds into `queue` on load.
 */
export type Bucket = "inbox" | "queue" | "archived";

export type SavedEpisode = {
  episodeId: string;
  showId?: string;
  title: string;
  showTitle?: string;
  coverUrl?: string;
  appleUrl?: string;
  audioUrl?: string;
  durationSec?: number;
  status: EpisodeStatus;
  positionSec: number;
  bucket: Bucket;
  /** Fractional rank within the queue; null outside `queue`. */
  queueRank: number | null;
  /**
   * When this episode was last handed off to an external player. WaveFM
   * can't observe playback there, so this plus `durationSec` is the entire
   * basis of the auto-retire guess (src/core/library/autoRetire.ts).
   */
  openedAt?: string;
  /**
   * True when `finished` was inferred rather than known — surfaced in the
   * history view as "assumed finished", so a guess never masquerades as fact.
   */
  finishedInferred?: boolean;
  savedAt: string;
  updatedAt: string;
};

export function episodeToSaved(e: CatalogEpisode): SavedEpisode {
  const now = new Date().toISOString();
  return {
    episodeId: e.id,
    showId: e.showId,
    title: e.title,
    showTitle: e.showTitle,
    coverUrl: e.coverUrl,
    appleUrl: e.appleUrl,
    audioUrl: e.audioUrl,
    durationSec: e.durationSec,
    status: "queued",
    positionSec: 0,
    bucket: "queue",
    // Newest save sorts to the top: real drag-assigned ranks cluster around
    // 0 (rankAtTop/rankBetween), so a large negative epoch-seconds rank
    // always lands above them, and decreases with each later save.
    queueRank: -Math.floor(Date.now() / 1000),
    savedAt: now,
    updatedAt: now,
  };
}

function readLocal(): SavedEpisode[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as SavedEpisode[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(items: SavedEpisode[]) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
  } catch {
    // storage full/blocked — saving silently fails rather than crashing
  }
}

async function currentUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user.id ?? null;
}

type Row = {
  episode_id: string;
  show_id: string | null;
  title: string;
  show_title: string | null;
  cover_url: string | null;
  apple_url: string | null;
  audio_url: string | null;
  duration_sec: number | null;
  status: EpisodeStatus;
  position_sec: number;
  bucket: Bucket;
  queue_rank: number | null;
  opened_at: string | null;
  finished_inferred: boolean | null;
  created_at: string;
  updated_at: string;
};

function rowToSaved(r: Row): SavedEpisode {
  return {
    episodeId: r.episode_id,
    showId: r.show_id ?? undefined,
    title: r.title,
    showTitle: r.show_title ?? undefined,
    coverUrl: r.cover_url ?? undefined,
    appleUrl: r.apple_url ?? undefined,
    audioUrl: r.audio_url ?? undefined,
    durationSec: r.duration_sec ?? undefined,
    status: r.status,
    positionSec: r.position_sec,
    bucket: r.bucket,
    queueRank: r.queue_rank,
    openedAt: r.opened_at ?? undefined,
    finishedInferred: r.finished_inferred ?? false,
    savedAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function savedToRow(userId: string, e: SavedEpisode) {
  return {
    user_id: userId,
    episode_id: e.episodeId,
    show_id: e.showId ?? null,
    title: e.title,
    show_title: e.showTitle ?? null,
    cover_url: e.coverUrl ?? null,
    apple_url: e.appleUrl ?? null,
    audio_url: e.audioUrl ?? null,
    duration_sec: e.durationSec ?? null,
    status: e.status,
    position_sec: e.positionSec,
    bucket: e.bucket,
    queue_rank: e.queueRank,
    opened_at: e.openedAt ?? null,
    finished_inferred: e.finishedInferred ?? false,
    updated_at: new Date().toISOString(),
  };
}

export async function listSavedEpisodes(): Promise<SavedEpisode[]> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!sb || !userId) return readLocal();
  const { data, error } = await sb
    .from("saved_episodes")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  // table missing / offline -> local fallback keeps the feature alive
  if (error || !data) return readLocal();
  return (data as Row[]).map(rowToSaved);
}

/** One bucket, pre-sorted: queue by rank (ascending), inbox/archived by most-recently-saved. */
export async function listByBucket(bucket: Bucket): Promise<SavedEpisode[]> {
  const sb = getSupabase();
  const userId = await currentUserId();
  const sortLocal = (items: SavedEpisode[]) =>
    bucket === "queue"
      ? items
          .filter((e) => e.bucket === bucket)
          .sort((a, b) => (a.queueRank ?? 0) - (b.queueRank ?? 0))
      : items
          .filter((e) => e.bucket === bucket)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (!sb || !userId) return sortLocal(readLocal());
  const { data, error } = await sb
    .from("saved_episodes")
    .select("*")
    .eq("user_id", userId)
    .eq("bucket", bucket)
    .order(bucket === "queue" ? "queue_rank" : "updated_at", {
      ascending: bucket === "queue",
    });
  if (error || !data) return sortLocal(readLocal());
  return (data as Row[]).map(rowToSaved);
}

/**
 * Triage action: move an episode into a bucket, setting its queue rank
 * (compute with src/core/queue/rank.ts — top/bottom/reorder-between-
 * neighbors — before calling this; it just writes what it's given).
 * `queueRank` is ignored outside `"queue"` (stored as null).
 */
export async function setEpisodeBucket(
  episodeId: string,
  bucket: Bucket,
  queueRank: number | null = null,
): Promise<void> {
  const rank = bucket === "queue" ? queueRank : null;
  const sb = getSupabase();
  const userId = await currentUserId();
  if (sb && userId) {
    const { error } = await sb
      .from("saved_episodes")
      .update({ bucket, queue_rank: rank, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("episode_id", episodeId);
    if (!error) return;
  }
  const now = new Date().toISOString();
  writeLocal(
    readLocal().map((e) =>
      e.episodeId === episodeId ? { ...e, bucket, queueRank: rank, updatedAt: now } : e,
    ),
  );
}

export async function isEpisodeSaved(episodeId: string): Promise<boolean> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!sb || !userId) return readLocal().some((e) => e.episodeId === episodeId);
  const { count, error } = await sb
    .from("saved_episodes")
    .select("episode_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("episode_id", episodeId);
  if (error) return readLocal().some((e) => e.episodeId === episodeId);
  return (count ?? 0) > 0;
}

export async function saveEpisode(episode: CatalogEpisode): Promise<void> {
  const item = episodeToSaved(episode);
  const sb = getSupabase();
  const userId = await currentUserId();
  if (sb && userId) {
    const { error } = await sb
      .from("saved_episodes")
      .upsert(savedToRow(userId, item), { ignoreDuplicates: true });
    if (!error) return;
  }
  const items = readLocal();
  if (items.some((e) => e.episodeId === item.episodeId)) return;
  writeLocal([item, ...items]);
}

export async function removeEpisode(episodeId: string): Promise<void> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (sb && userId) {
    const { error } = await sb
      .from("saved_episodes")
      .delete()
      .eq("user_id", userId)
      .eq("episode_id", episodeId);
    if (!error) return;
  }
  writeLocal(readLocal().filter((e) => e.episodeId !== episodeId));
}

/**
 * Record that this episode was just handed off to an external player.
 *
 * Signed in this writes `opened_at`, so auto-retire and listen history work
 * on every device rather than only the one that did the handoff. Signed out
 * it falls through to localStorage like everything else here.
 */
export async function markHandedOff(episodeId: string, at = new Date()): Promise<void> {
  const iso = at.toISOString();
  const sb = getSupabase();
  const userId = await currentUserId();
  if (sb && userId) {
    const { error } = await sb
      .from("saved_episodes")
      .update({ opened_at: iso, updated_at: iso })
      .eq("user_id", userId)
      .eq("episode_id", episodeId);
    if (!error) return;
  }
  writeLocal(
    readLocal().map((e) =>
      e.episodeId === episodeId ? { ...e, openedAt: iso, updatedAt: iso } : e,
    ),
  );
}

/**
 * Mark an episode finished, recording whether that was inferred rather than
 * observed. `opened_at` is cleared so a re-listen starts a fresh window and
 * the auto-retire scan doesn't keep re-examining a settled row.
 */
export async function markFinished(episodeId: string, inferred: boolean): Promise<void> {
  const now = new Date().toISOString();
  const sb = getSupabase();
  const userId = await currentUserId();
  if (sb && userId) {
    const { error } = await sb
      .from("saved_episodes")
      .update({
        status: "finished",
        finished_inferred: inferred,
        opened_at: null,
        updated_at: now,
      })
      .eq("user_id", userId)
      .eq("episode_id", episodeId);
    if (!error) return;
  }
  writeLocal(
    readLocal().map((e) =>
      e.episodeId === episodeId
        ? { ...e, status: "finished" as const, finishedInferred: inferred, openedAt: undefined, updatedAt: now }
        : e,
    ),
  );
}

/** Set status and/or resume position — one call per user action. */
export async function updateEpisodeProgress(
  episodeId: string,
  patch: { status?: EpisodeStatus; positionSec?: number },
): Promise<void> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (sb && userId) {
    const { error } = await sb
      .from("saved_episodes")
      .update({
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.positionSec != null ? { position_sec: patch.positionSec } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("episode_id", episodeId);
    if (!error) return;
  }
  const now = new Date().toISOString();
  writeLocal(
    readLocal().map((e) =>
      e.episodeId === episodeId
        ? {
            ...e,
            status: patch.status ?? e.status,
            positionSec: patch.positionSec ?? e.positionSec,
            updatedAt: now,
          }
        : e,
    ),
  );
}

/** Pushes signed-out saves to Supabase after sign-in, then clears local. */
export async function migrateLocalEpisodes(): Promise<void> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!sb || !userId) return;
  const local = readLocal();
  if (local.length === 0) return;
  for (const item of local) {
    const { error } = await sb
      .from("saved_episodes")
      .upsert(savedToRow(userId, item), { ignoreDuplicates: true });
    if (error) return; // table missing — keep local copies
  }
  writeLocal([]);
}

/**
 * One-shot manual pull sync from gpodder.net (REFINEMENTS.md #3, "External
 * player progress sync") — reconciles play position from an external
 * client (AntennaPod, gpodder desktop, ...) back into the Library. The
 * password is used only for this one request to our own proxy route and
 * is never persisted anywhere. Returns the number of episodes updated;
 * never throws — any failure (bad credentials, network, no matches)
 * resolves to 0.
 */
/**
 * Pull real listening progress from Pocket Casts. Returns how many saved
 * episodes were updated, or 0 on any failure — a sync that can't run must
 * never break the Library.
 *
 * Credentials are passed straight through to the route for one request and
 * never stored here. Where this reports a status it OVERRIDES the
 * time-based auto-retire guess, because a played flag from the player is a
 * fact and the heuristic is an inference. `finished` is recorded as
 * NOT inferred, so history shows it as known rather than assumed.
 */
export type PocketCastsSyncResult = {
  /** Saved episodes whose status/position changed. */
  episodes: number;
  /** Subscriptions added to the library. */
  shows: number;
  /** A stored token was rejected — the UI must ask for credentials again. */
  expired?: boolean;
};

export async function syncFromPocketCasts(
  creds: { email: string; password: string } | { token: string },
): Promise<PocketCastsSyncResult> {
  try {
    const res = await fetch("/api/sync/pocketcasts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(creds),
    });

    if (res.status === 401) {
      const why = (await res.json().catch(() => ({}))) as { reason?: string };
      if (why.reason === "expired") {
        // Forget it, or every later sync silently fails the same way.
        await setPocketCastsToken(null);
        return { episodes: 0, shows: 0, expired: true };
      }
      return { episodes: 0, shows: 0 };
    }
    if (!res.ok) return { episodes: 0, shows: 0 };

    const json = (await res.json()) as {
      episodes?: PocketCastsEpisode[];
      podcasts?: PocketCastsPodcast[];
      token?: string;
    };

    // Freshly minted — keep it so the password isn't needed again.
    if (json.token) await setPocketCastsToken(json.token);

    const episodes = await listSavedEpisodes();
    const updates = matchPocketCastsHistory(json.episodes ?? [], episodes);
    for (const u of updates) {
      if (u.status === "finished") {
        await markFinished(u.episodeId, false);
      } else {
        await updateEpisodeProgress(u.episodeId, {
          status: u.status,
          positionSec: u.positionSec,
        });
      }
    }

    // Subscriptions: additive only. Nothing is removed here, ever — see
    // newSubscriptions for why an unsubscribe there mustn't delete a show.
    let shows = 0;
    const podcasts = json.podcasts ?? [];
    if (podcasts.length > 0) {
      const saved = await listSaved();
      const fresh = newSubscriptions(
        podcasts,
        saved.map((s) => ({ feedUrl: s.show.feedUrl, title: s.show.title })),
      );
      for (const sub of fresh) {
        await saveShow({
          // No catalog id for a feed we've only seen in Pocket Casts, so use
          // the same stable rss- id scheme OPML import uses.
          id: `rss-${stableFeedId(sub.feedUrl)}`,
          source: "rss",
          title: sub.title,
          author: sub.author ?? "",
          feedUrl: sub.feedUrl,
          categories: [],
        });
      }
      shows = fresh.length;
    }

    return { episodes: updates.length, shows };
  } catch {
    return { episodes: 0, shows: 0 };
  }
}

export async function syncFromGpodder(username: string, password: string): Promise<number> {
  try {
    const res = await fetch("/api/sync/gpodder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) return 0;
    const json = (await res.json()) as {
      actions?: { audioUrl: string; positionSec: number; totalSec?: number }[];
    };
    const actions = json.actions ?? [];
    if (actions.length === 0) return 0;

    const episodes = await listSavedEpisodes();
    const updates = matchGpodderActions(actions, episodes);
    for (const u of updates) {
      await updateEpisodeProgress(u.episodeId, { status: u.status, positionSec: u.positionSec });
    }
    return updates.length;
  } catch {
    return 0;
  }
}
