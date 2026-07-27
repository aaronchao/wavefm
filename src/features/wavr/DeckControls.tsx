"use client";

import { Pressable } from "@/src/ui";
import type { PlayState } from "./useDeckAudio";

/** The a11y-canonical controls — tab order reaches them before the card. */
export function DeckControls({
  onSkip,
  onSave,
  onTogglePlay,
  playState,
  disabled,
}: {
  onSkip: () => void;
  onSave: () => void;
  onTogglePlay: () => void;
  playState: PlayState;
  disabled: boolean;
}) {
  const playGlyph = playState === "playing" ? "❚❚" : playState === "unavailable" ? "♪" : "▶";
  return (
    <div className="flex items-center justify-center gap-5">
      <ControlButton size={56} label="Skip this episode" onClick={onSkip} disabled={disabled}>
        ✕
      </ControlButton>
      <ControlButton
        size={64}
        label="Play preview"
        onClick={onTogglePlay}
        accent
        disabled={disabled && playState !== "locked"}
      >
        {playGlyph}
      </ControlButton>
      <ControlButton size={56} label="Save to library" onClick={onSave} disabled={disabled}>
        ♥
      </ControlButton>
    </div>
  );
}

function ControlButton({
  children,
  label,
  onClick,
  disabled,
  accent = false,
  size,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled: boolean;
  accent?: boolean;
  size: number;
}) {
  return (
    <Pressable
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      style={{ width: size, height: size }}
      className={`flex items-center justify-center rounded-full border text-xl shadow-sm disabled:opacity-40 ${
        accent
          ? "border-accent bg-accent text-white"
          : "border-surface-border bg-background text-zinc-500"
      }`}
    >
      {children}
    </Pressable>
  );
}
