import { getServerSupabase } from "@/src/data/supabase/server";

/**
 * Generic server-only monthly usage counter (REFINEMENTS.md #19) — a hard,
 * code-enforced cap independent of trusting a free tier's own rate
 * limiting. Read-then-write, not a single atomic SQL increment: fine for
 * a soft cap on this app's traffic (a rare double-counted race just means
 * the cap trips one call earlier, never later). Degrades to "allow" (null)
 * when Supabase isn't configured/reachable — an infra hiccup should never
 * silently brick a feature that would otherwise work.
 */
function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

/** This month's recorded usage — 0 when unset/unreachable (fail open, not closed). */
export async function getMonthlyUsage(provider: string): Promise<number> {
  const sb = getServerSupabase();
  if (!sb) return 0;
  const { data } = await sb
    .from("usage_counters")
    .select("count")
    .eq("provider", provider)
    .eq("period", currentPeriod())
    .maybeSingle();
  return (data as { count?: number } | null)?.count ?? 0;
}

/** Record one more use. Call AFTER a call actually succeeds, not before. */
export async function incrementMonthlyUsage(provider: string): Promise<void> {
  const sb = getServerSupabase();
  if (!sb) return;
  const period = currentPeriod();
  const current = await getMonthlyUsage(provider);
  await sb
    .from("usage_counters")
    .upsert({ provider, period, count: current + 1, updated_at: new Date().toISOString() });
}
