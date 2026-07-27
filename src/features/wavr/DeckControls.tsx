"use client";

import { Pressable } from "@/src/ui";

/**
 * The a11y-canonical controls — tab order reaches them before the card.
 * Skip / overview / save, thumb-reachable in that order: the episode plays
 * itself the moment it's on top (no tap needed, §Wavr audio), and tapping
 * the card toggles play/pause, so these three cover what's left — leave,
 * see the whole deck, or keep it. "+" matches the save affordance used
 * everywhere else in the app (Wavr Mini, Discover); "?" is deliberately
 * plain rather than a fussy grid glyph — it reads as "what else is there?"
 */
export function DeckControls({
  onSkip,
  onOverview,
  onSave,
  disabled,
}: {
  onSkip: () => void;
  onOverview: () => void;
  onSave: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-6">
      <ControlButton size={56} label="Skip this episode" onClick={onSkip} disabled={disabled}>
        ✕
      </ControlButton>
      <ControlButton size={44} label="Overview: see the whole deck" onClick={onOverview} disabled={disabled}>
        ?
      </ControlButton>
      <ControlButton size={56} label="Save to library" onClick={onSave} disabled={disabled} accent>
        +
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
