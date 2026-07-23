import { getSupabase } from "@/src/data/supabase/client";
import { normalizeTag } from "./showTagsRepo";

/**
 * User-generated tags per saved episode — mirrors showTagsRepo exactly, one
 * table over (`episode_tags`). The Library's per-episode inline tag input
 * and the tag filter rail read/write this store. Signed in → Supabase
 * (syncs across devices); signed out, unconfigured, or table missing →
 * localStorage. All failures degrade silently.
 */

const LOCAL_KEY = "wavr.episodeTags.v1";

export type EpisodeTagMap = Record<string, string[]>;

function readLocal(): EpisodeTagMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as EpisodeTagMap) : {};
  } catch {
    return {};
  }
}

function writeLocal(map: EpisodeTagMap) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
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

type Row = { episode_id: string; tag: string };

/** The full tag map for the current scope (Supabase when signed in). */
export async function listEpisodeTags(): Promise<EpisodeTagMap> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!sb || !userId) return readLocal();
  const { data, error } = await sb
    .from("episode_tags")
    .select("episode_id, tag")
    .eq("user_id", userId);
  if (error || !data) return readLocal();
  const map: EpisodeTagMap = {};
  for (const r of data as Row[]) {
    (map[r.episode_id] ??= []).push(r.tag);
  }
  return map;
}

/** Add a tag to an episode (idempotent). */
export async function addEpisodeTag(episodeId: string, raw: string): Promise<void> {
  const tag = normalizeTag(raw);
  if (!tag) return;
  const sb = getSupabase();
  const userId = await currentUserId();
  if (sb && userId) {
    const { error } = await sb
      .from("episode_tags")
      .upsert(
        { user_id: userId, episode_id: episodeId, tag },
        { onConflict: "user_id,episode_id,tag", ignoreDuplicates: true },
      );
    if (!error) return;
  }
  const map = readLocal();
  const tags = map[episodeId] ?? [];
  if (!tags.includes(tag)) writeLocal({ ...map, [episodeId]: [...tags, tag] });
}

/** Remove a tag from an episode. */
export async function removeEpisodeTag(episodeId: string, tag: string): Promise<void> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (sb && userId) {
    const { error } = await sb
      .from("episode_tags")
      .delete()
      .eq("user_id", userId)
      .eq("episode_id", episodeId)
      .eq("tag", tag);
    if (!error) return;
  }
  const map = readLocal();
  const tags = (map[episodeId] ?? []).filter((t) => t !== tag);
  const next = { ...map };
  if (tags.length > 0) next[episodeId] = tags;
  else delete next[episodeId];
  writeLocal(next);
}
