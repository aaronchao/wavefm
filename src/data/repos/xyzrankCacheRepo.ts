import { getServerSupabase } from "@/src/data/supabase/server";

/**
 * Reads the shared `xyzrank_cache` table populated by scripts/ingest-xyzrank.ts
 * (a scheduled GitHub Actions job, not Vercel — see that script's doc for
 * why). Server-side only. Missing table/row/Supabase config all degrade to
 * null silently, same as every other best-effort source in this app.
 */
export async function readXyzrankCache<T>(board: string): Promise<T | null> {
  const sb = getServerSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb
      .from("xyzrank_cache")
      .select("payload")
      .eq("board", board)
      .maybeSingle();
    return (data?.payload as T | undefined) ?? null;
  } catch {
    return null;
  }
}
