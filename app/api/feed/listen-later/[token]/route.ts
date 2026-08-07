import { buildListenLaterRss } from "@/src/core/feed/rss";
import { getServerSupabase } from "@/src/data/supabase/server";

/**
 * Personal Listen-Later feed (REFINEMENTS.md #2) — the sync mechanic for
 * any podcast app that supports "Add by URL" (Apple Podcasts, Overcast,
 * Pocket Casts, AntennaPod, Castro, Downcast, ...). The URL itself is the
 * credential (an opaque per-user token in `prefs.feed_token`) — same
 * private-feed pattern every "personal podcast playlist" tool uses, so no
 * session/auth header is expected here.
 *
 * Won't reach Spotify or YouTube Music — neither supports listener-added
 * arbitrary RSS at all (see src/core/links.ts). Any player only refreshes
 * on its own poll schedule, not instantly.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const sb = getServerSupabase();
  if (!sb) return new Response("Feed unavailable", { status: 503 });

  const { data: pref } = await sb
    .from("prefs")
    .select("user_id")
    .eq("feed_token", token)
    .maybeSingle();
  if (!pref) return new Response("Not found", { status: 404 });

  const { data: rows } = await sb
    .from("saved_episodes")
    .select("episode_id, title, audio_url, duration_sec, cover_url")
    .eq("user_id", pref.user_id)
    .eq("bucket", "queue")
    .order("queue_rank", { ascending: true });

  const episodes = (rows ?? []).map((r) => ({
    episodeId: r.episode_id as string,
    title: r.title as string,
    audioUrl: (r.audio_url as string | null) ?? undefined,
    durationSec: (r.duration_sec as number | null) ?? undefined,
    coverUrl: (r.cover_url as string | null) ?? undefined,
  }));

  // Absolute URL — RSS artwork is fetched by the podcast client, not the
  // browser, so a root-relative path would never resolve for it.
  const imageUrl = new URL("/cover-3000.png", request.url).toString();

  const xml = buildListenLaterRss(episodes, {
    title: "WaveFM",
    description: "Your personal Listen-Later queue, synced from WaveFM.",
    selfUrl: request.url,
    imageUrl,
  });

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
