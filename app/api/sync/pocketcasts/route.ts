import { NextResponse } from "next/server";
import type {
  PocketCastsEpisode,
  PocketCastsPodcast,
} from "@/src/core/sync/pocketCastsMatch";

/**
 * Proxy: one-shot pull sync of listening progress from Pocket Casts.
 *
 * This is the accurate half of the listen-status problem. Auto-retire only
 * guesses from elapsed time; Pocket Casts actually knows. It doesn't speak
 * gpodder.net, so the existing sync route can't reach it.
 *
 * CREDENTIAL HANDLING — same scope as the gpodder route, deliberately:
 * the email/password arrive in the body, are used ONLY to mint a short-lived
 * Pocket Casts token for this single request, and are never persisted and
 * never logged. There is no pocketcasts_username/password column anywhere,
 * and adding one is out of scope. Nothing is written back to Pocket Casts —
 * this is strictly Pocket Casts -> WaveFM.
 *
 * UNOFFICIAL API. api.pocketcasts.com is what their own web player uses; it
 * is undocumented and unsupported, so it can change without notice. Every
 * failure path returns { episodes: [] } rather than an error, so a broken
 * upstream degrades to "no sync happened" instead of a broken Library. That
 * is also why the accurate sync is an opt-in on top of the heuristic rather
 * than a replacement for it.
 */

const LOGIN_URL = "https://api.pocketcasts.com/user/login";
const HISTORY_URL = "https://api.pocketcasts.com/user/history";
const PODCAST_LIST_URL = "https://api.pocketcasts.com/user/podcast/list";

/** Their login payload has used both spellings across versions. */
type LoginResponse = { token?: string; accessToken?: string };

async function login(email: string, password: string): Promise<string | null | "auth"> {
  const res = await fetch(LOGIN_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, scope: "webplayer" }),
  });
  if (res.status === 401 || res.status === 403) return "auth";
  if (!res.ok) return null;
  const json = (await res.json()) as LoginResponse;
  return json.token ?? json.accessToken ?? null;
}

async function post(url: string, token: string): Promise<unknown | null> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
  // A stale stored token shows up here, not at login.
  if (res.status === 401 || res.status === 403) return "auth";
  if (!res.ok) return null;
  return res.json();
}

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown; token?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ episodes: [], podcasts: [] }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const existingToken = typeof body.token === "string" ? body.token : "";
  if (!existingToken && (!email || !password)) {
    return NextResponse.json({ episodes: [], podcasts: [] }, { status: 400 });
  }

  try {
    // A stored token skips the password entirely — that's the whole point of
    // keeping it. Only fall back to credentials when there isn't one.
    let token = existingToken;
    let minted = false;
    if (!token) {
      const result = await login(email, password);
      if (result === "auth") {
        return NextResponse.json({ episodes: [], podcasts: [], reason: "auth" }, { status: 401 });
      }
      if (!result) return NextResponse.json({ episodes: [], podcasts: [] });
      token = result;
      minted = true;
    }

    const history = await post(HISTORY_URL, token);
    if (history === "auth") {
      // The stored token expired or was revoked (changing the Pocket Casts
      // password does this). Say so specifically so the UI can ask for
      // credentials again rather than reporting a mystery empty sync.
      return NextResponse.json(
        { episodes: [], podcasts: [], reason: "expired" },
        { status: 401 },
      );
    }

    const episodes = ((history as { episodes?: PocketCastsEpisode[] } | null)?.episodes ?? []).map(
      (e) => ({
        url: typeof e.url === "string" ? e.url : undefined,
        playingStatus: typeof e.playingStatus === "number" ? e.playingStatus : undefined,
        playedUpTo: typeof e.playedUpTo === "number" ? e.playedUpTo : undefined,
        duration: typeof e.duration === "number" ? e.duration : undefined,
      }),
    );

    // Subscriptions, so subscribing in Pocket Casts flows into saved shows.
    // Strictly additive and one-way on the client side — nothing is ever
    // written back to Pocket Casts, and an unsubscribe there never removes
    // a saved show here.
    const listed = await post(PODCAST_LIST_URL, token);
    const podcasts =
      listed === "auth"
        ? []
        : ((listed as { podcasts?: PocketCastsPodcast[] } | null)?.podcasts ?? []).map((p) => ({
            uuid: typeof p.uuid === "string" ? p.uuid : undefined,
            title: typeof p.title === "string" ? p.title : undefined,
            author: typeof p.author === "string" ? p.author : undefined,
            url: typeof p.url === "string" ? p.url : undefined,
            feedUrl: typeof p.feedUrl === "string" ? p.feedUrl : undefined,
          }));

    // Matching happens on the client, where the saved library lives — the
    // same split as the gpodder route, and it keeps this endpoint from
    // needing to see the user's library at all. The token is returned only
    // when freshly minted, so the client can store it and stop asking for
    // a password.
    return NextResponse.json({ episodes, podcasts, ...(minted ? { token } : {}) });
  } catch {
    return NextResponse.json({ episodes: [], podcasts: [] });
  }
}
