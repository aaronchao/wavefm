"use client";

import { platformLinks, type PlatformId } from "@/src/core/links";

/**
 * "Open in" deep-links as mini app icons — listen to a saved show/episode
 * wherever you actually listen. Stored URL when known (Apple), else a
 * platform search for the title. A platform with no link renders dimmed,
 * never an error. Links stop propagation so they work inside a full-card
 * play button; each icon carries an aria-label + tooltip.
 */
export function OpenInLinks({
  title,
  appleUrl,
  className = "",
}: {
  title: string;
  appleUrl?: string;
  className?: string;
}) {
  const links = platformLinks(title, { apple: appleUrl });
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <span className="font-brand text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Open in
      </span>
      {links.map((l) => {
        const Icon = PLATFORM_ICONS[l.id];
        return l.url ? (
          <a
            key={l.id}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Open in ${l.label}`}
            title={`${l.label}${l.isSearch ? " (search)" : ""}`}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-surface text-zinc-600 transition-colors hover:bg-accent-soft hover:text-accent dark:text-zinc-300"
          >
            <Icon className="h-4 w-4" />
          </a>
        ) : (
          <span
            key={l.id}
            aria-disabled
            title={`${l.label} — link unavailable`}
            className="flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-full bg-surface text-zinc-400 opacity-40"
          >
            <Icon className="h-4 w-4" />
          </span>
        );
      })}
    </div>
  );
}

type IconProps = { className?: string };

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
