import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

/**
 * Service-role Supabase client for the offline pipeline + the community-recs
 * route. Bypasses RLS, so it is SERVER-ONLY (never import from a client
 * component). Returns null when the service key isn't configured, so a fresh
 * clone / preview without secrets degrades instead of crashing.
 */
export function getAdminSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  admin ??= createClient(url, key, { auth: { persistSession: false } });
  return admin;
}
