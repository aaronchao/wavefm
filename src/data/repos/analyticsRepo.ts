import { getSupabase } from "@/src/data/supabase/client";

/**
 * Minimal first-party analytics (REFINEMENTS.md #29) — "is discovery
 * working" (saves/session, not-for-me rate, preview→open funnel) without
 * a third-party vendor. Fire-and-forget: never throws, never blocks the
 * caller, and callers don't await it. No local-storage fallback when
 * Supabase isn't configured — losing observability events in that case
 * is an acceptable trade against adding a second persistence path for
 * data nobody but the team ever reads.
 */
export function trackEvent(event: string, showId?: string): void {
  const sb = getSupabase();
  if (!sb) return;
  void sb.auth
    .getSession()
    .then(({ data }) =>
      sb.from("analytics_events").insert({
        user_id: data.session?.user.id ?? null,
        event,
        show_id: showId ?? null,
      }),
    )
    .catch(() => {
      // best-effort — a dropped event never surfaces to the user
    });
}
