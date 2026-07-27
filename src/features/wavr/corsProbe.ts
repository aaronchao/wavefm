"use client";

/**
 * "Probe, never gamble" (§6.6). Real FFT analysis needs
 * `crossOrigin="anonymous"` on the <audio> element, but setting that on a
 * host that doesn't send `Access-Control-Allow-Origin` makes the load fail
 * outright and kills playback. So: one 1-byte Range probe per host, cached
 * for the session, BEFORE ever setting crossOrigin on a real element.
 */

const cache = new Map<string, Promise<boolean>>();
const SESSION_KEY = "wavr.cors.hosts";

function readCache(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function writeCache(host: string, ok: boolean) {
  try {
    const all = readCache();
    all[host] = ok;
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** Resolves true when the URL's host allows cross-origin audio analysis. */
export function probeHostCors(url: string): Promise<boolean> {
  const host = hostOf(url);
  if (!host) return Promise.resolve(false);

  const stored = readCache()[host];
  if (stored !== undefined) return Promise.resolve(stored);

  const inFlight = cache.get(host);
  if (inFlight) return inFlight;

  const probe = fetch(url, { method: "GET", headers: { Range: "bytes=0-0" }, mode: "cors" })
    .then(() => true)
    .catch(() => false)
    .then((ok) => {
      writeCache(host, ok);
      return ok;
    });
  cache.set(host, probe);
  return probe;
}
