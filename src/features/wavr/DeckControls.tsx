"use client";

import { Pressable } from "@/src/ui";

/**
 * The a11y-canonical controls — tab order reaches them before the card.
 * Just skip/save: the episode plays itself the moment it's on top (no tap
 * needed, §Wavr audio), and tapping the card toggles play/pause, so a third
 * button here would only ever duplicate one of those two paths.
 */
export function DeckControls({
  onSkip,
  onSave,
  disabled,
}: {
  onSkip: () => void;
  onSave: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-8">
      <ControlButton size={56} label="Skip this episode" onClick={onSkip} disabled={disabled}>
        ✕
      </ControlButton>
      <ControlButton size={56} label="Save to library" onClick={onSave} disabled={disabled} accent>
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
