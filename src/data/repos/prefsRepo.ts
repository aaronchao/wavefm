import { getSupabase } from "@/src/data/supabase/client";
import type { PrefsRow } from "@/src/data/supabase/types";

/**
 * User prefs (interests, rating sources). Signed in -> Supabase;
 * signed out -> localStorage, migrated on sign-in.
 */

const LOCAL_KEY = "wavr.prefs.v1";

export type Prefs = Pick<PrefsRow, "interests" | "rating_sources">;

export const DEFAULT_PREFS: Prefs = {
  interests: [],
  rating_sources: { douban: true, xiaoyuzhou: true },
};

function readLocal(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Prefs) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function writeLocal(prefs: Prefs) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

async function currentUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function getPrefs(): Promise<Prefs> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!sb || !userId) return readLocal();
  const { data } = await sb
    .from("prefs")
    .select("interests, rating_sources")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as Prefs | null) ?? DEFAULT_PREFS;
}

export async function setInterests(interests: string[]): Promise<void> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!sb || !userId) {
    writeLocal({ ...readLocal(), interests });
    return;
  }
  await sb.from("prefs").upsert({
    user_id: userId,
    interests,
    updated_at: new Date().toISOString(),
  });
}

export async function setRatingSources(
  rating_sources: Prefs["rating_sources"],
): Promise<void> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!sb || !userId) {
    writeLocal({ ...readLocal(), rating_sources });
    return;
  }
  await sb.from("prefs").upsert({
    user_id: userId,
    rating_sources,
    updated_at: new Date().toISOString(),
  });
}

/** Copies signed-out prefs to Supabase after sign-in (if none exist yet). */
export async function migrateLocalPrefs(): Promise<void> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!sb || !userId) return;
  const local = readLocal();
  if (local.interests.length === 0) return;
  const { data } = await sb
    .from("prefs")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) return; // cloud prefs already exist — don't clobber
  await sb.from("prefs").upsert({ user_id: userId, interests: local.interests });
}
