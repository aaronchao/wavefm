import { NextResponse } from "next/server";
import type { PocketCastsEpisode } from "@/src/core/sync/pocketCastsMatch";

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

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ episodes: [] }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ episodes: [] }, { status: 400 });
  }

  try {
    const loginRes = await fetch(LOGIN_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, scope: "webplayer" }),
    });

    if (loginRes.status === 401 || loginRes.status === 403) {
      return NextResponse.json({ episodes: [], reason: "auth" }, { status: 401 });
    }
    if (!loginRes.ok) {
      return NextResponse.json({ episodes: [] });
    }

    const login = (await loginRes.json()) as { token?: string; accessToken?: string };
    // Their payload has used both spellings across versions.
    const token = login.token ?? login.accessToken;
    if (!token) return NextResponse.json({ episodes: [] });

    const historyRes = await fetch(HISTORY_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    if (!historyRes.ok) return NextResponse.json({ episodes: [] });

    const data = (await historyRes.json()) as { episodes?: PocketCastsEpisode[] };
    const episodes = (data.episodes ?? []).map((e) => ({
      url: typeof e.url === "string" ? e.url : undefined,
      playingStatus: typeof e.playingStatus === "number" ? e.playingStatus : undefined,
      playedUpTo: typeof e.playedUpTo === "number" ? e.playedUpTo : undefined,
      duration: typeof e.duration === "number" ? e.duration : undefined,
    }));

    // Matching happens on the client, where the saved episodes live — the
    // same split as the gpodder route, and it keeps this endpoint from
    // needing to see the user's library at all.
    return NextResponse.json({ episodes });
  } catch {
    return NextResponse.json({ episodes: [] });
  }
}
