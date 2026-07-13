import type { CatalogEpisode } from "@/src/data/catalog/types";
import { getSupabase } from "@/src/data/supabase/client";

/**
 * Listen-later collection: episodes the user liked, with playback status
 * and a resume point. Signed in -> Supabase (syncs across devices);
 * signed out, unconfigured, or table missing -> localStorage. All
 * failures degrade silently, mirroring savedShowsRepo.
 */

const LOCAL_KEY = "wavr.savedEpisodes.v1";

export type EpisodeStatus = "queued" | "in_progress" | "finished";

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
