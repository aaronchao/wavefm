"use client";

/**
 * The a11y-canonical controls — tab order reaches them before the card.
 * Skip / overview / save, thumb-reachable in that order. Frosted-glass
 * circular buttons to match the Liquid Glass card, with Save the one
 * Signal-Red control (keeping a card is the deck's real signal). "+" matches
 * the save affordance used everywhere else (Wavr Mini, Discover); "?" reads
 * as "what else is there?".
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
    <div className="flex items-center justify-center gap-7">
      <GlassButton size={56} label="Skip this episode" onClick={onSkip} disabled={disabled}>
        ✕
      </GlassButton>
      <GlassButton size={46} label="Overview: see the whole deck" onClick={onOverview} disabled={disabled}>
        ?
      </GlassButton>
      <button
        type="button"
        aria-label="Save to library"
        onClick={onSave}
        disabled={disabled}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-xl text-white shadow-[0_6px_20px_rgba(255,59,48,0.4)] transition-transform hover:-translate-y-0.5 hover:scale-105 active:scale-95 disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}

/** A frosted-glass circular control — translucent + blurred, soft border. */
function GlassButton({
  children,
  label,
  onClick,
  disabled,
  size,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled: boolean;
  size: number;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-full border border-surface-border bg-background/70 text-lg text-foreground shadow-md backdrop-blur-xl transition-transform hover:-translate-y-0.5 hover:scale-105 active:scale-95 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
