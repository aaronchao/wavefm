import type { CatalogShow } from "@/src/data/catalog/types";
import { getSupabase } from "@/src/data/supabase/client";
import type { ShowRow } from "@/src/data/supabase/types";
import { recordEngagement } from "./engagementRepo";
import { rowToCatalogShow, upsertShow } from "./showRepo";

/**
 * Saved shows. Signed in -> Supabase (source of truth, syncs across
 * devices). Signed out or unconfigured -> localStorage, migrated to
 * Supabase on first sign-in. All failures degrade silently.
 */

const LOCAL_KEY = "wavr.savedShows.v1";

export type SavedShow = { show: CatalogShow; savedAt: string };

function readLocal(): SavedShow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as SavedShow[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(items: SavedShow[]) {
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

export async function listSaved(): Promise<SavedShow[]> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!sb || !userId) return readLocal();
  const { data, error } = await sb
    .from("saved_shows")
    .select("created_at, shows(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data
    .filter((r) => r.shows)
    .map((r) => ({
      show: rowToCatalogShow(r.shows as unknown as ShowRow),
      savedAt: r.created_at,
    }));
}

export async function isSaved(showId: string): Promise<boolean> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!sb || !userId) return readLocal().some((s) => s.show.id === showId);
  const { count } = await sb
    .from("saved_shows")
    .select("show_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("show_id", showId);
  return (count ?? 0) > 0;
}

export async function saveShow(show: CatalogShow): Promise<void> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!sb || !userId) {
    const items = readLocal();
    if (items.some((s) => s.show.id === show.id)) return;
    writeLocal([{ show, savedAt: new Date().toISOString() }, ...items]);
    return;
  }
  await upsertShow(show); // FK target must exist before the save row
  await sb
    .from("saved_shows")
    .upsert({ user_id: userId, show_id: show.id }, { ignoreDuplicates: true });
  void recordEngagement(show.id, "save");
}

export async function unsaveShow(showId: string): Promise<void> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!sb || !userId) {
    writeLocal(readLocal().filter((s) => s.show.id !== showId));
    return;
  }
  await sb
    .from("saved_shows")
    .delete()
    .eq("user_id", userId)
    .eq("show_id", showId);
}

/** Pushes signed-out saves to Supabase after sign-in, then clears local. */
export async function migrateLocalSaves(): Promise<void> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!sb || !userId) return;
  const local = readLocal();
  if (local.length === 0) return;
  for (const item of local) {
    await upsertShow(item.show);
    await sb
      .from("saved_shows")
      .upsert(
        { user_id: userId, show_id: item.show.id, created_at: item.savedAt },
        { ignoreDuplicates: true },
      );
  }
  writeLocal([]);
}
