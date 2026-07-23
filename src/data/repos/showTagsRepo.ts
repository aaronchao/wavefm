import { getSupabase } from "@/src/data/supabase/client";

/**
 * User-generated tags per saved show — the Library's tagging system and the
 * show-detail tag input read/write the same store, so a tag added on a show
 * page appears in the Library filter and vice-versa. Signed in → Supabase
 * (`show_tags`, syncs across devices); signed out, unconfigured, or table
 * missing → localStorage. All failures degrade silently, mirroring the other
 * repos. Tags are stored as a `{ showId: string[] }` map.
 */

const LOCAL_KEY = "wavr.showTags.v1";

export type ShowTagMap = Record<string, string[]>;

/** Normalise a tag: trimmed, collapsed whitespace, capped length. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, 32);
}

function readLocal(): ShowTagMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as ShowTagMap) : {};
  } catch {
    return {};
  }
}

function writeLocal(map: ShowTagMap) {
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

type Row = { show_id: string; tag: string };

/** The full tag map for the current scope (Supabase when signed in). */
export async function listShowTags(): Promise<ShowTagMap> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!sb || !userId) return readLocal();
  const { data, error } = await sb
    .from("show_tags")
    .select("show_id, tag")
    .eq("user_id", userId);
  if (error || !data) return readLocal();
  const map: ShowTagMap = {};
  for (const r of data as Row[]) {
    (map[r.show_id] ??= []).push(r.tag);
  }
  return map;
}

/** Add a tag to a show (idempotent). Returns the show's updated tag list. */
export async function addShowTag(showId: string, raw: string): Promise<void> {
  const tag = normalizeTag(raw);
  if (!tag) return;
  const sb = getSupabase();
  const userId = await currentUserId();
  if (sb && userId) {
    const { error } = await sb
      .from("show_tags")
      .upsert(
        { user_id: userId, show_id: showId, tag },
        { onConflict: "user_id,show_id,tag", ignoreDuplicates: true },
      );
    if (!error) return;
  }
  const map = readLocal();
  const tags = map[showId] ?? [];
  if (!tags.includes(tag)) writeLocal({ ...map, [showId]: [...tags, tag] });
}

/** Remove a tag from a show. */
export async function removeShowTag(showId: string, tag: string): Promise<void> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (sb && userId) {
    const { error } = await sb
      .from("show_tags")
      .delete()
      .eq("user_id", userId)
      .eq("show_id", showId)
      .eq("tag", tag);
    if (!error) return;
  }
  const map = readLocal();
  const tags = (map[showId] ?? []).filter((t) => t !== tag);
  const next = { ...map };
  if (tags.length > 0) next[showId] = tags;
  else delete next[showId];
  writeLocal(next);
}

/** The de-duplicated union of every tag the user has created, sorted. */
export function allTagsFrom(map: ShowTagMap): string[] {
  const set = new Set<string>();
  for (const tags of Object.values(map)) for (const t of tags) set.add(t);
  return [...set].sort((a, b) => a.localeCompare(b));
}
