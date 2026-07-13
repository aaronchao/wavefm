import type { BuzzInput } from "@/src/core/recommend";

/**
 * 小宇宙 stats via its (unofficial) app API — the API that ultrazg/xyz
 * wraps. It requires a logged-in account: obtain tokens once with any
 * ultrazg/xyz deployment (SMS login), then set
 *   XIAOYUZHOU_ACCESS_TOKEN / XIAOYUZHOU_REFRESH_TOKEN
 * in the environment. Without tokens this provider is silently absent —
 * xyzrank still supplies 小宇宙-derived buzz for ranked shows for free.
 */

const REVALIDATE_SECONDS = 24 * 60 * 60;
const BASE = "https://api.xiaoyuzhoufm.com";
// headers 小宇宙's app API expects alongside the token
const APP_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "app-version": "2.57.1",
  "x-jike-device-id": "wavr-personal",
  "x-jike-device-properties": JSON.stringify({ platform: "web" }),
  "User-Agent": "wavr/0.1 (personal podcast discovery)",
};

// 小宇宙 access tokens are short-lived; a refresh token mints new ones.
// Cache the freshest access token in-process (best-effort across warm
// invocations — serverless may still reuse the env token on cold starts).
let liveAccess: string | null = null;

function envAccess(): string | null {
  return process.env.XIAOYUZHOU_ACCESS_TOKEN || null;
}

/** Exchange the refresh token for a new access token; null on any failure. */
async function refreshAccess(): Promise<string | null> {
  const refresh = process.env.XIAOYUZHOU_REFRESH_TOKEN;
  if (!refresh) return null;
  try {
    const res = await fetch(`${BASE}/app_auth_tokens.refresh`, {
      method: "POST",
      headers: { ...APP_HEADERS, "x-jike-refresh-token": refresh },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const headerToken = res.headers.get("x-jike-access-token");
    if (headerToken) return headerToken;
    const json = (await res.json()) as { "x-jike-access-token"?: string };
    return json["x-jike-access-token"] ?? null;
  } catch {
    return null;
  }
}

type XyzPodcast = {
  title?: string;
  subscriptionCount?: number;
  playCount?: number;
  commentCount?: number;
};

async function search(title: string, token: string): Promise<Response> {
  return fetch(`${BASE}/v1/search/create`, {
    method: "POST",
    headers: { ...APP_HEADERS, "x-jike-access-token": token },
    body: JSON.stringify({ keyword: title, type: "PODCAST" }),
    next: { revalidate: REVALIDATE_SECONDS },
  });
}

export async function xiaoyuzhouBuzz(title: string): Promise<BuzzInput | null> {
  const token = liveAccess ?? envAccess();
  if (!token) return null; // not configured — skip, never an error
  try {
    let res = await search(title, token);
    // token expired -> refresh once and retry
    if (res.status === 401 || res.status === 403) {
      const fresh = await refreshAccess();
      if (!fresh) return null;
      liveAccess = fresh;
      res = await search(title, fresh);
    }
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: XyzPodcast[] };
    const hit = (json.data ?? []).find(
      (p) => p.title?.trim().toLowerCase() === title.trim().toLowerCase(),
    );
    if (!hit) return null;
    return {
      subscribers: hit.subscriptionCount,
      plays: hit.playCount,
      comments: hit.commentCount,
    };
  } catch {
    return null;
  }
}

/** Merge buzz objects, earlier sources winning per field. */
export function mergeBuzz(
  ...sources: (BuzzInput | null | undefined)[]
): BuzzInput | undefined {
  const out: BuzzInput = {};
  let any = false;
  for (const s of sources) {
    if (!s) continue;
    for (const [k, v] of Object.entries(s) as [keyof BuzzInput, number][]) {
      if (v != null && out[k] == null) {
        out[k] = v;
        any = true;
      }
    }
  }
  return any ? out : undefined;
}
