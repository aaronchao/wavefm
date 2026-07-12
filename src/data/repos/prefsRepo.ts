import { getSupabase } from "@/src/data/supabase/client";
import type { PrefsRow } from "@/src/data/supabase/types";

export const DEFAULT_PREFS: Pick<PrefsRow, "interests" | "rating_sources"> = {
  interests: [],
  rating_sources: { douban: true, xiaoyuzhou: true },
};

export async function getPrefs(): Promise<typeof DEFAULT_PREFS> {
  const sb = getSupabase();
  if (!sb) return DEFAULT_PREFS;
  const { data: auth } = await sb.auth.getSession();
  if (!auth.session) return DEFAULT_PREFS;
  const { data } = await sb
    .from("prefs")
    .select("interests, rating_sources")
    .eq("user_id", auth.session.user.id)
    .maybeSingle();
  return data ?? DEFAULT_PREFS;
}

export async function setInterests(interests: string[]): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { data: auth } = await sb.auth.getSession();
  if (!auth.session) return false;
  const { error } = await sb.from("prefs").upsert({
    user_id: auth.session.user.id,
    interests,
    updated_at: new Date().toISOString(),
  });
  return !error;
}
