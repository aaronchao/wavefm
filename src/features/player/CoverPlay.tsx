"use client";

import { CoverTile } from "@/src/ui";

/**
 * A podcast cover with a centered play-triangle overlay — matching the
 * "For You" show-tile design (Trending/Saved rails). Tapping it routes the
 * clip through the app-wide Play Bar (`onPlay`) — never an inline <audio>
 * of its own, so only one source ever plays at a time. Shared by Ranks,
 * Charts, and the Library.
 */
export function CoverPlay({
  src,
  size = 56,
  onPlay,
  label,
  className = "",
}: {
  src?: string;
  size?: number;
  onPlay: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onPlay();
      }}
      aria-label={label}
      className={`group relative block shrink-0 overflow-hidden rounded-tile ${className}`}
      style={{ width: size, height: size }}
    >
      <CoverTile src={src} size={size} />
      <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-sm text-white opacity-0 transition-opacity group-hover:bg-black/30 group-hover:opacity-100">
        ▶
      </span>
    </button>
  );
}
