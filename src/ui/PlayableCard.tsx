"use client";

import type { ReactNode } from "react";
import { Card } from "./primitives";
import { SettleIn } from "./motion";

/**
 * A card whose whole surface plays a preview, with a11y-correct nesting:
 * the play action is a transparent full-card <button> sibling (keyboard-
 * focusable, real button semantics), NOT a role="button" wrapping other
 * interactive elements. Row content renders above it; any interactive
 * control inside (a link, a Chip) must add `relative z-10` so it sits
 * above the overlay and receives its own clicks.
 */
export function PlayableCard({
  onPlay,
  playLabel,
  className = "",
  children,
}: {
  onPlay: () => void;
  playLabel: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <SettleIn>
      <Card className={`relative flex items-center gap-3 ${className}`}>
        <button
          type="button"
          aria-label={playLabel}
          onClick={onPlay}
          className="absolute inset-0 rounded-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        />
        {children}
      </Card>
    </SettleIn>
  );
}
