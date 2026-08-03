import { getServerSupabase } from "@/src/data/supabase/server";

/**
 * Public "share your Queue" page's data source — opt-in (Section 11
 * override, explicitly approved): the token only resolves once a user has
 * turned sharing on (`prefs.share_token`), same private-token-as-credential
 * pattern as the personal Listen-Later feed. Deliberately returns only
 * what the curator chose to queue — no user_id, email, or other account
 * detail ever leaves this route.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const sb = getServerSupabase();
  if (!sb) return new Response("Unavailable", { status: 503 });

  const { data: pref } = await sb
    .from("prefs")
    .select("user_id")
    .eq("share_token", token)
    .maybeSingle();
  if (!pref) return new Response("Not found", { status: 404 });

  const { data: rows } = await sb
    .from("saved_episodes")
    .select("episode_id, title, show_id, show_title, cover_url, apple_url, audio_url, duration_sec")
    .eq("user_id", pref.user_id)
    .eq("bucket", "queue")
    .order("queue_rank", { ascending: true });

  const episodes = (rows ?? []).map((r) => ({
    id: r.episode_id as string,
    title: r.title as string,
    showId: (r.show_id as string | null) ?? undefined,
    showTitle: (r.show_title as string | null) ?? undefined,
    coverUrl: (r.cover_url as string | null) ?? undefined,
    appleUrl: (r.apple_url as string | null) ?? undefined,
    audioUrl: (r.audio_url as string | null) ?? undefined,
    durationSec: (r.duration_sec as number | null) ?? undefined,
  }));

  return Response.json(
    { episodes },
    { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
