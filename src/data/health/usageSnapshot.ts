import { getServerSupabase } from "@/src/data/supabase/server";
import { getMonthlyUsage } from "@/src/data/repos/usageCountersRepo";

/**
 * Cost/quotas snapshot (REFINEMENTS.md #30) — a simple monthly check to
 * stay honest about the $0 promise as free-tier usage grows. Two things
 * this app can actually measure itself:
 *   - Supabase row counts per key table (the free tier caps total
 *     storage/rows, not per-table, but per-table growth is what's
 *     actionable — which table to prune or archive).
 *   - Listen Notes calls this month (the same usage_counters table the
 *     monthly kill-switch already writes to — see listennotes.ts).
 *
 * Deliberately NOT included: Vercel bandwidth/function usage. Vercel's
 * own usage API needs a VERCEL_TOKEN + project id — a separate credential
 * this app doesn't otherwise need, so it's out of scope for this pass.
 * Check the Vercel dashboard directly for that number.
 */

const TRACKED_TABLES = [
  "shows",
  "saved_shows",
  "engagement",
  "prefs",
  "saved_episodes",
  "ratings_cache",
  "analytics_events",
  "raw_documents",
  "rec_edges",
  "podcast_aliases",
  "usage_counters",
];

export type TableUsage = { table: string; rows: number | null };

export type UsageSnapshot = {
  tables: TableUsage[];
  listenNotesThisMonth: number;
};

export async function getUsageSnapshot(): Promise<UsageSnapshot> {
  const sb = getServerSupabase();
  const tables = await Promise.all(
    TRACKED_TABLES.map(async (table): Promise<TableUsage> => {
      if (!sb) return { table, rows: null };
      try {
        const { count } = await sb.from(table).select("*", { count: "exact", head: true });
        return { table, rows: count ?? null };
      } catch {
        return { table, rows: null };
      }
    }),
  );
  const listenNotesThisMonth = await getMonthlyUsage("listennotes");
  return { tables, listenNotesThisMonth };
}
