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

/** External-rating badge (Douban/Xiaoyuzhou). Renders nothing without a rating. */
export function RatingBadge({
  source,
  rating,
}: {
  source: string;
  rating: number | null | undefined;
}) {
  if (rating == null) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
      ★ <span className="font-brand">{rating.toFixed(1)}</span>
      <span className="font-normal opacity-70">{source}</span>
    </span>
  );
}
