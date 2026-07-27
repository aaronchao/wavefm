"use client";

import { useState } from "react";
import { platformLinks, type PlatformId } from "@/src/core/links";
import type { PlatformLinks } from "@/src/data/catalog/types";

/**
 * "Open in" deep-links as mini app icons — listen to a saved show/episode
 * wherever you actually listen. Icon logic (applied globally — Library,
 * Discovery, the floating Play bar):
 *   • A stored deep-link → the icon renders in the player's BRAND colour and
 *     opens that URL.
 *   • Only a title-search fallback → the icon renders GRAYSCALE (still opens
 *     the platform search, so discovery never dead-ends).
 *   • No link at all → GRAYSCALE + disabled.
 * Reads `show.platformLinks.{spotify,youtubeMusic,xiaoyuzhou}` — audited to
 * match the payload's actual key names so a real stored URL always resolves
 * to its brand colour. A generic RSS icon always sits alongside (never
 * conditionally hidden, matching every other platform icon's presence):
 * clicking it copies the raw feed URL to the clipboard for apps without a
 * web add-by-URL flow (e.g. YouTube Music); grayscale + disabled without a
 * feed URL. Links stop propagation so they work inside a full-card play
 * button.
 */
export function OpenInLinks({
  title,
  appleUrl,
  feedUrl,
  stored,
  className = "",
  label = "Open in",
  size = "sm",
  onOpen,
}: {
  title: string;
  appleUrl?: string;
  /** Raw RSS feed URL — enables the copy-to-clipboard RSS icon. */
  feedUrl?: string;
  /** Stored player deep-links from the payload (brand-coloured when present). */
  stored?: PlatformLinks;
  className?: string;
  /** Tiny inline caption; pass "" for icons only (a heading supplies context). */
  label?: string;
  /** "md" gives larger tappable targets for the show-detail Listen-on row. */
  size?: "sm" | "md";
  /** Fired when a link is opened (e.g. to record an 'open' engagement). */
  onOpen?: () => void;
}) {
  const links = platformLinks(title, { apple: appleUrl, ...stored });
  const box = size === "md" ? "h-9 w-9" : "h-7 w-7";
  const glyph = size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    // flex-nowrap keeps the icons on one horizontal, scrollable row on mobile
    // instead of stacking; a heading supplies context so labels stay off.
    <div className={`flex flex-nowrap items-center gap-1.5 overflow-x-auto ${className}`}>
      {label && (
        <span className="font-brand shrink-0 text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {label}
        </span>
      )}
      {links.map((l) => {
        const Icon = PLATFORM_ICONS[l.id];
        // Brand colour only for a real stored link; search fallbacks are grey.
        const branded = Boolean(l.url) && !l.isSearch;
        if (!l.url) {
          return (
            <span
              key={l.id}
              aria-disabled
              title={`${l.label} — link unavailable`}
              className={`flex ${box} shrink-0 cursor-not-allowed items-center justify-center rounded-full bg-surface text-zinc-400 opacity-40`}
            >
              <Icon className={glyph} />
            </span>
          );
        }
        return (
          <a
            key={l.id}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.stopPropagation();
              onOpen?.();
            }}
            aria-label={`Open in ${l.label}${l.isSearch ? " (search)" : ""}`}
            title={`${l.label}${l.isSearch ? " (search)" : ""}`}
            style={branded ? { color: PLATFORM_COLORS[l.id] } : undefined}
            className={`flex ${box} shrink-0 items-center justify-center rounded-full transition-colors ${
              branded
                ? "bg-surface hover:opacity-80"
                : "bg-surface text-zinc-400 grayscale hover:text-zinc-600 dark:hover:text-zinc-200"
            }`}
          >
            <Icon className={glyph} />
          </a>
        );
      })}
      {/* Always present — matches the global icon design system (a platform
          icon renders even when disabled, never disappears). Grayscale +
          disabled without a feed; brand colour + copy action with one. */}
      <RssCopyIcon feedUrl={feedUrl} box={box} glyph={glyph} />
    </div>
  );
}

/** Copies the raw RSS feed URL to the clipboard for manual paste. */
function RssCopyIcon({
  feedUrl,
  box,
  glyph,
}: {
  feedUrl?: string;
  box: string;
  glyph: string;
}) {
  const [copied, setCopied] = useState(false);
  async function copy(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked — fail silently, never a blocking error
    }
  }
  if (!feedUrl) {
    return (
      <span
        aria-disabled
        title="RSS feed — unavailable"
        className={`flex ${box} shrink-0 cursor-not-allowed items-center justify-center rounded-full bg-surface text-zinc-400 opacity-40`}
      >
        <RssIcon className={glyph} />
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "RSS feed URL copied" : "Copy RSS feed URL"}
      title={copied ? "Copied ✓" : "Copy RSS feed URL"}
      style={copied ? undefined : { color: RSS_COLOR }}
      className={`flex ${box} shrink-0 items-center justify-center rounded-full bg-surface transition-colors hover:opacity-80 ${
        copied ? "text-accent" : ""
      }`}
    >
      {copied ? (
        <svg viewBox="0 0 24 24" className={glyph} fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <RssIcon className={glyph} />
      )}
    </button>
  );
}

type IconProps = { className?: string };

/** Brand colours — applied only when a real stored deep-link exists. */
const PLATFORM_COLORS: Record<PlatformId, string> = {
  apple: "#9933CC",
  spotify: "#1DB954",
  youtubeMusic: "#FF0000",
  xiaoyuzhou: "#FA5757",
};
const RSS_COLOR = "#EE802F";

/** Compact single-colour marks — recognisable, no external assets. */
const PLATFORM_ICONS: Record<PlatformId, (p: IconProps) => React.ReactElement> = {
  apple: AppleIcon,
  spotify: SpotifyIcon,
  youtubeMusic: YoutubeMusicIcon,
  xiaoyuzhou: XiaoyuzhouIcon,
};

function AppleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M16.6 12.9c0-2.2 1.8-3.2 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.3.8-.7 0-1.8-.8-3-.8-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .8 1.1 1.7 2.3 2.8 2.3 1.1 0 1.6-.7 2.9-.7 1.4 0 1.7.7 2.9.7 1.2 0 2-1.1 2.8-2.2.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.5-1-2.5-3.8zM14.4 5.6c.6-.8 1-1.8.9-2.9-.9 0-2 .6-2.6 1.4-.6.7-1.1 1.8-.9 2.8 1 .1 2-.5 2.6-1.3z" />
    </svg>
  );
}

function SpotifyIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M7.6 9.9c2.9-.8 6.1-.5 8.7.9M8 12.7c2.3-.6 4.8-.3 6.9.8M8.4 15.3c1.8-.4 3.7-.2 5.3.6" strokeLinecap="round" />
    </svg>
  );
}

function YoutubeMusicIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.6 9.8l4 2.2-4 2.2z" fill="currentColor" />
    </svg>
  );
}

function XiaoyuzhouIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="4.5" fill="currentColor" />
      <ellipse
        cx="12"
        cy="12"
        rx="9"
        ry="3.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        transform="rotate(-18 12 12)"
      />
    </svg>
  );
}

function RssIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <circle cx="6.2" cy="17.8" r="1.8" />
      <path d="M4 10.2a9.8 9.8 0 019.8 9.8h2.6A12.4 12.4 0 004 7.6z" />
      <path d="M4 4.2a15.8 15.8 0 0115.8 15.8h2.6A18.4 18.4 0 004 1.6z" />
    </svg>
  );
}
