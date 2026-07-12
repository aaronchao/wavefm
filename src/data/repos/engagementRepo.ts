import { ENGAGEMENT_WEIGHTS, type EngagementType } from "@/src/core/engagement";
import { getSupabase } from "@/src/data/supabase/client";

/**
 * Records engagement events (the recommendation engine's input signal).
 * Signed-out or unconfigured -> silent no-op; never blocks the UI action
 * that triggered it.
 */
export async function recordEngagement(
  showId: string,
  type: EngagementType,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { data } = await sb.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return;
  await sb.from("engagement").insert({
    user_id: userId,
    show_id: showId,
    type,
    weight: ENGAGEMENT_WEIGHTS[type],
  });
}
