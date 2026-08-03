"use client";

import { Pressable } from "./motion";

/** Soft-depth container with the card radius token. */
export function Card({
  children,
  className = "",
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-card border border-surface-border bg-background p-3 shadow-sm ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Cover art tile; renders a neutral placeholder when no URL. */
export function CoverTile({
  src,
  size = 64,
  className = "",
}: {
  src?: string;
  size?: number;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`shrink-0 rounded-tile bg-surface ${className}`}
      />
    );
  }
  return (
    // arbitrary external art hosts; skip Vercel image optimization
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      style={{ width: size, height: size }}
      className={`shrink-0 rounded-tile object-cover ${className}`}
    />
  );
}

/** One-click pill button — used for "why" reasons, filters, and actions. */
export function Chip({
  children,
  active = false,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  active?: boolean;
  /** Receives the event so rows-inside-clickable-cards can stopPropagation. */
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}) {
  return (
    <Pressable
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-pill px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-accent-soft text-accent"
          : "bg-surface text-foreground hover:opacity-80"
      } ${className}`}
    >
      {children}
    </Pressable>
  );
}

/**
 * Subtle, non-blocking notice for a thin-but-not-empty result (§5 P2):
 * several routes already return `degraded: true` alongside real results
 * when SOME providers failed and others still came through, but the UI
 * only ever checked that flag next to an empty-results branch — so a
 * partially-degraded feed looked like "this is all there is" instead of
 * "some sources are unavailable right now". Render only when there's
 * both degradation AND something to show alongside it; the full-failure
 * empty-state message elsewhere still owns the zero-results case.
 */
export function DegradedHint({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-muted-foreground dark:text-zinc-500 ${className}`}>
      Some sources are unavailable right now — results may be thinner than usual.
    </p>
  );
}

/** Dot-matrix "machine" micro-label — the Nothing-brand technical voice. */
export function MachineLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`font-brand text-[11px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-300 ${className}`}
    >
      {children}
    </span>
  );
}
