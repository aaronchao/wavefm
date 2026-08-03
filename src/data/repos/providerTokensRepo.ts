import { getServerSupabase } from "@/src/data/supabase/server";

/**
 * Server-only cross-instance cache for provider access tokens
 * (REFINEMENTS.md #18) — a refreshed token was previously kept only in
 * module memory, lost on every serverless cold start (a fresh refresh
 * every time). This gives warm AND cold invocations a shared fallback.
 * Never throws; a missing/unreachable table degrades to "no cached
 * token", same as before this existed.
 */

export async function getProviderToken(provider: string): Promise<string | null> {
  const sb = getServerSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from("provider_tokens")
    .select("access_token")
    .eq("provider", provider)
    .maybeSingle();
  return (data as { access_token?: string } | null)?.access_token ?? null;
}

export async function setProviderToken(provider: string, accessToken: string): Promise<void> {
  const sb = getServerSupabase();
  if (!sb) return;
  await sb
    .from("provider_tokens")
    .upsert({ provider, access_token: accessToken, updated_at: new Date().toISOString() });
}
