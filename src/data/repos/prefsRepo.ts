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

/**
 * The stored Pocket Casts bearer token plus when a sync last ran, so a
 * sync doesn't ask for the password every time and the Library knows
 * whether an auto-sync is due (src/core/library/autoSync.ts). The PASSWORD
 * is never stored — only this token, which the user can revoke by changing
 * their Pocket Casts password. Both null when signed out of WaveFM
 * (nowhere to keep them) or never connected.
 */
export type PocketCastsConnection = { token: string | null; syncedAt: string | null };

export async function getPocketCastsConnection(): Promise<PocketCastsConnection> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!sb || !userId) return { token: null, syncedAt: null };
  const { data } = await sb
    .from("prefs")
    .select("pocketcasts_token, pocketcasts_synced_at")
    .eq("user_id", userId)
    .maybeSingle();
  const row = data as { pocketcasts_token?: string | null; pocketcasts_synced_at?: string | null } | null;
  return { token: row?.pocketcasts_token ?? null, syncedAt: row?.pocketcasts_synced_at ?? null };
}

/** Store (or, with null, forget) the Pocket Casts token. */
export async function setPocketCastsToken(token: string | null): Promise<void> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!sb || !userId) return;
  await sb
    .from("prefs")
    .upsert({ user_id: userId, pocketcasts_token: token }, { onConflict: "user_id" });
}

/** Records that a sync (manual or auto) just ran — resets the auto-sync
 *  throttle window regardless of which path triggered it. */
export async function setPocketCastsSyncedAt(at = new Date()): Promise<void> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!sb || !userId) return;
  await sb
    .from("prefs")
    .upsert(
      { user_id: userId, pocketcasts_synced_at: at.toISOString() },
      { onConflict: "user_id" },
    );
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

export type ShareInfo = { token: string | null; slug: string | null };

/**
 * The public "share your Queue" page's identity. Opt-in and off by
 * default (unlike feed_token, which is always generated) — a null token
 * means sharing is off and no public page resolves for this user.
 * `slug` is the optional human-chosen name (`/u/my-name`); when unset the
 * public URL falls back to the raw token. Supabase-only, same reasoning
 * as the feed token: a public link needs a stable server-side identity.
 */
export async function getShareInfo(): Promise<ShareInfo> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!sb || !userId) return { token: null, slug: null };
  const { data } = await sb
    .from("prefs")
    .select("share_token, share_slug")
    .eq("user_id", userId)
    .maybeSingle();
  const row = data as { share_token?: string | null; share_slug?: string | null } | null;
  return { token: row?.share_token ?? null, slug: row?.share_slug ?? null };
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

/** Turns sharing off — the public page immediately 404s for this user.
 *  Clears any custom name too, so it's free for someone else to claim
 *  rather than staying reserved by a link that no longer works. */
export async function disableSharing(): Promise<void> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!sb || !userId) return;
  await sb
    .from("prefs")
    .upsert({ user_id: userId, share_token: null, share_slug: null, updated_at: new Date().toISOString() });
}

const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/;

/**
 * Names (or renames) the public share link. Validated client-side against
 * the same pattern the DB enforces (`prefs_share_slug_format`), so an
 * obviously-invalid name never round-trips just to fail. A name already
 * taken by another account surfaces as a friendly "taken" error (Postgres
 * unique-violation, code 23505) rather than a generic failure — the
 * caller re-prompts for a different name.
 */
export async function setShareSlug(
  raw: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const slug = raw.trim().toLowerCase();
  if (!SLUG_PATTERN.test(slug)) {
    return {
      ok: false,
      error: "2-40 characters: lowercase letters, numbers, and hyphens only, no leading/trailing hyphen.",
    };
  }
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!sb || !userId) return { ok: false, error: "Sign in to name your link." };
  const { error } = await sb
    .from("prefs")
    .upsert({ user_id: userId, share_slug: slug, updated_at: new Date().toISOString() });
  if (!error) return { ok: true };
  if (error.code === "23505") {
    return { ok: false, error: "That name is taken — try another." };
  }
  return { ok: false, error: "Couldn't save that name — try again." };
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
