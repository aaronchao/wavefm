import { NextResponse } from "next/server";

/**
 * Proxy: one-shot manual pull sync from gpodder.net (REFINEMENTS.md #3,
 * "External player progress sync"). Users who listen to saved episodes in
 * an external player (AntennaPod, gpodder desktop, ...) that syncs its
 * play position to gpodder.net can pull that progress back into Wavr.
 *
 * Body: { username, password } — the gpodder.net account credentials,
 * used ONLY to build the HTTP Basic-auth header for this single upstream
 * request. Never logged, never persisted (no gpodder_username/
 * gpodder_password column anywhere — see CLAUDE.md PROXY_EXTERNAL_CALLS /
 * NO_HARD_DEPS_ON_EXTERNAL_APIS, and REFINEMENTS.md #3's explicit "do not
 * store the password" scope). One direction only: gpodder.net -> Wavr.
 *
 * gpodder.net "Simple API" episode-actions endpoint, confirmed against
 * gpodder.net's own docs (gpoddernet.readthedocs.io/en/latest/api/
 * reference/events.html) rather than guessed:
 *   GET https://gpodder.net/api/2/episodes/{username}.json?since={unix}
 *   Auth: HTTP Basic (gpodder.net username/password).
 *   Response: { actions: [{ podcast, episode, device, action, timestamp,
 *               started?, position?, total? }], timestamp }
 *   `action` is lowercase: "download" | "play" | "delete" | "new" | "flattr".
 *   `episode` is the episode's enclosure/audio URL — that's what we match
 *   against `saved_episodes.audio_url` on the client side.
 * One thing the docs don't pin down precisely: whether `position`/`total`
 * are always present-and-numeric on every "play" action, or can be absent
 * (some other gpodder client implementations default them to -1 instead of
 * omitting the field). We treat both "missing" and "-1" as "no position
 * info" and drop the action, to be safe either way.
 *
 * No per-user "last synced at" is tracked (deliberately, per scope) — we
 * just bound the request with a fixed lookback window.
 */

const LOOKBACK_DAYS = 30;

type GpodderApiAction = {
  episode?: string;
  action?: string;
  position?: number;
  total?: number;
};

export type GpodderPullAction = {
  audioUrl: string;
  positionSec: number;
  totalSec?: number;
};

export async function POST(request: Request) {
  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ actions: [] }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) {
    return NextResponse.json({ actions: [] }, { status: 400 });
  }

  try {
    const since = Math.floor(Date.now() / 1000) - LOOKBACK_DAYS * 24 * 60 * 60;
    const auth = Buffer.from(`${username}:${password}`).toString("base64");
    const res = await fetch(
      `https://gpodder.net/api/2/episodes/${encodeURIComponent(username)}.json?since=${since}`,
      { headers: { Authorization: `Basic ${auth}` } },
    );

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ actions: [] }, { status: 401 });
    }
    if (!res.ok) {
      return NextResponse.json({ actions: [] }); // any other upstream hiccup -> silent skip
    }

    const data = (await res.json()) as { actions?: GpodderApiAction[] };
    const actions: GpodderPullAction[] = (data.actions ?? [])
      .filter(
        (a): a is GpodderApiAction & { episode: string; position: number } =>
          a.action === "play" &&
          typeof a.episode === "string" &&
          a.episode.length > 0 &&
          typeof a.position === "number" &&
          a.position >= 0,
      )
      .map((a) => ({
        audioUrl: a.episode,
        positionSec: a.position,
        totalSec: typeof a.total === "number" && a.total > 0 ? a.total : undefined,
      }));

    return NextResponse.json({ actions });
  } catch {
    return NextResponse.json({ actions: [] }); // network error, bad JSON, etc. -> never a blocking error
  }
}
