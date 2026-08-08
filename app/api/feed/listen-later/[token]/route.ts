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

  // Absolute URLs, built from the PUBLIC origin — a podcast client fetches
  // these from the outside world, so a root-relative path is useless to it
  // and `request.url` alone is unreliable: behind Vercel's proxy it can
  // carry the internal invocation host rather than the deployed domain,
  // which would point the artwork and the self-link at somewhere Pocket
  // Casts can't reach. The forwarded headers are the real origin.
  const origin = publicOrigin(request);
  const imageUrl = new URL("/cover-3000.png", origin).toString();
  const selfUrl = new URL(new URL(request.url).pathname, origin).toString();

  const xml = buildListenLaterRss(episodes, {
    title: "WaveFM",
    description: "Your personal Listen-Later queue, synced from WaveFM.",
    selfUrl,
    imageUrl,
  });

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/** The externally-reachable origin, preferring the proxy's forwarded headers. */
function publicOrigin(request: Request): string {
  const h = request.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return new URL(request.url).origin;
}
