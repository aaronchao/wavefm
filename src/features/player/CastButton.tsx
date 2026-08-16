"use client";

import { useEffect, useRef, useState } from "react";

const SDK_SRC = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";

/**
 * Minimal ambient shape for the bits of the Cast Web Sender SDK
 * (`cast.framework` / `chrome.cast`) this file touches. The SDK is loaded
 * from Google's CDN at runtime (see SDK_SRC below), not installed as an
 * npm package, so there's no @types package backing this — just enough
 * of the shape to type-check the calls we actually make.
 */
declare global {
  interface Window {
    __onGCastApiAvailable?: (available: boolean) => void;
    cast?: {
      framework: {
        CastContext: {
          getInstance(): {
            setOptions(opts: { receiverApplicationId: string; autoJoinPolicy: string }): void;
            requestSession(): Promise<void>;
            endCurrentSession(stopCasting: boolean): void;
            getCurrentSession(): CastSession | null;
            addEventListener(type: string, cb: (e: { sessionState: string }) => void): void;
          };
        };
        CastContextEventType: { SESSION_STATE_CHANGED: string };
        SessionState: { SESSION_STARTED: string; SESSION_RESUMED: string; SESSION_ENDED: string };
      };
    };
    chrome?: {
      cast: {
        AutoJoinPolicy: { ORIGIN_SCOPED: string };
        media: {
          DEFAULT_MEDIA_RECEIVER_APP_ID: string;
          MediaInfo: new (contentId: string, contentType: string) => MediaInfo;
          GenericMediaMetadata: new () => { title?: string; subtitle?: string };
          LoadRequest: new (mediaInfo: MediaInfo) => LoadRequest;
        };
      };
    };
  }
  interface MediaInfo {
    metadata?: { title?: string; subtitle?: string };
  }
  interface LoadRequest {
    autoplay: boolean;
    currentTime: number;
  }
  interface CastSession {
    loadMedia(request: LoadRequest): Promise<void>;
  }
}

function sdkReady() {
  return typeof window !== "undefined" && !!window.cast?.framework && !!window.chrome?.cast;
}

/**
 * Chromecast support (2026-08-16 ask: "Make sure the podcast player
 * control can be casted on Chromecast... controlled by any Bluetooth
 * headphone" — Bluetooth is already covered by useMediaSession.ts; this
 * is the Chromecast half). Uses the Cast Web Sender SDK's
 * DEFAULT_MEDIA_RECEIVER_APP_ID, which needs no developer-console app
 * registration for basic audio/video casting — unlike a standalone
 * smart-speaker/Assistant integration (declined earlier, see
 * useMediaSession.ts), this one is genuinely buildable without an
 * external account.
 *
 * Only renders once the SDK reports a cast-capable device is on the same
 * network — there's nothing useful to show otherwise, and Chromecast
 * itself is untestable here without physical hardware (flagged in
 * feedback-wavefm.md).
 */
export function CastButton({ audioUrl, title }: { audioUrl: string; title: string }) {
  // Lazy init reads real state at mount instead of setState-ing it in an
  // effect body — matters when the SDK script is already loaded from a
  // prior mount (player closed and reopened).
  const [available, setAvailable] = useState(sdkReady);
  const [connected, setConnected] = useState(false);
  const metaRef = useRef({ audioUrl, title });

  useEffect(() => {
    metaRef.current = { audioUrl, title };
  }, [audioUrl, title]);

  useEffect(() => {
    if (typeof window === "undefined" || sdkReady()) return;

    window.__onGCastApiAvailable = (isAvailable: boolean) => {
      if (!isAvailable || !sdkReady()) return;
      const ctx = window.cast!.framework.CastContext.getInstance();
      ctx.setOptions({
        receiverApplicationId: window.chrome!.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
        autoJoinPolicy: window.chrome!.cast.AutoJoinPolicy.ORIGIN_SCOPED,
      });
      ctx.addEventListener(window.cast!.framework.CastContextEventType.SESSION_STATE_CHANGED, (e) => {
        const started = window.cast!.framework.SessionState.SESSION_STARTED;
        const resumed = window.cast!.framework.SessionState.SESSION_RESUMED;
        setConnected(e.sessionState === started || e.sessionState === resumed);
      });
      setAvailable(true);
    };

    if (document.querySelector(`script[src="${SDK_SRC}"]`)) return;
    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    document.head.appendChild(script);
  }, []);

  // Cast whatever's currently loaded whenever the session connects, or
  // the track changes while already connected.
  useEffect(() => {
    if (!connected || !sdkReady()) return;
    const session = window.cast!.framework.CastContext.getInstance().getCurrentSession();
    if (!session) return;
    const mediaInfo = new window.chrome!.cast.media.MediaInfo(metaRef.current.audioUrl, "audio/mpeg");
    const metadata = new window.chrome!.cast.media.GenericMediaMetadata();
    metadata.title = metaRef.current.title;
    mediaInfo.metadata = metadata;
    const request = new window.chrome!.cast.media.LoadRequest(mediaInfo);
    void session.loadMedia(request).catch(() => {});
  }, [connected, audioUrl]);

  if (!available) return null;

  function toggle() {
    if (!sdkReady()) return;
    const ctx = window.cast!.framework.CastContext.getInstance();
    if (connected) ctx.endCurrentSession(true);
    else void ctx.requestSession().catch(() => {});
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={connected ? "Stop casting" : "Cast to device"}
      aria-pressed={connected}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
        connected ? "text-accent" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <CastIcon />
    </button>
  );
}

function CastIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M2 8V4a2 2 0 012-2h16a2 2 0 012 2v16a2 2 0 01-2 2h-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 12a9 9 0 018 8" strokeLinecap="round" />
      <path d="M2 16a5 5 0 014 4" strokeLinecap="round" />
      <circle cx="3" cy="20" r="1" fill="currentColor" />
    </svg>
  );
}
