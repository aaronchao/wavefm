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
  rating_sources: { apple: true, douban: true, xiaoyuzhou: true },
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

/**
 * The personal Listen-Later feed URL's token (REFINEMENTS.md #2) — server
 * generated (`prefs.feed_token` defaults to `gen_random_uuid()`), so this
 * is Supabase-only; there's no meaningful local-only equivalent (syncing
 * to an external podcast app requires a stable server-side URL, same
 * sign-in requirement as every other cross-device feature here).
 */
export async function getFeedToken(): Promise<string | null> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!sb || !userId) return null;
  const { data } = await sb
    .from("prefs")
    .select("feed_token")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as { feed_token?: string } | null)?.feed_token ?? null;
}

/** Regenerates the feed token (e.g. if the URL ever leaks) and returns the new one. */
export async function regenerateFeedToken(): Promise<string | null> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!sb || !userId) return null;
  const feed_token = crypto.randomUUID();
  const { error } = await sb
    .from("prefs")
    .upsert({ user_id: userId, feed_token, updated_at: new Date().toISOString() });
  return error ? null : feed_token;
}

/**
 * The public "share your Queue" page's token. Opt-in and off by default
 * (unlike feed_token, which is always generated) — null means sharing is
 * off and no public page resolves for this user. Supabase-only, same
 * reasoning as the feed token: a public link needs a stable server-side
 * identity to resolve against.
 */
export async function getShareToken(): Promise<string | null> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!sb || !userId) return null;
  const { data } = await sb
    .from("prefs")
    .select("share_token")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as { share_token?: string | null } | null)?.share_token ?? null;
}

/** Turns sharing on (or rotates the link if it leaked) and returns the new token. */
export async function enableSharing(): Promise<string | null> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!sb || !userId) return null;
  const share_token = crypto.randomUUID();
  const { error } = await sb
    .from("prefs")
    .upsert({ user_id: userId, share_token, updated_at: new Date().toISOString() });
  return error ? null : share_token;
}

/** Turns sharing off — the public page immediately 404s for this user. */
export async function disableSharing(): Promise<void> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!sb || !userId) return;
  await sb
    .from("prefs")
    .upsert({ user_id: userId, share_token: null, updated_at: new Date().toISOString() });
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
