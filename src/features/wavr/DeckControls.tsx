"use client";

/**
 * The a11y-canonical controls — tab order reaches them before the card.
 * Skip / overview / save, thumb-reachable in that order. Nothing-brand:
 * monochrome circular buttons (`nothing-circle` — foreground fill, inverts
 * with a Signal-Red glow on hover), except Save which is the one filled
 * Signal-Red control since keeping a card is the deck's real signal. "+"
 * matches the save affordance used everywhere else (Wavr Mini, Discover);
 * "?" reads as "what else is there?".
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
      <button
        type="button"
        aria-label="Skip this episode"
        onClick={onSkip}
        disabled={disabled}
        className="nothing-circle h-14 w-14 text-xl"
      >
        ✕
      </button>
      <button
        type="button"
        aria-label="Overview: see the whole deck"
        onClick={onOverview}
        disabled={disabled}
        className="nothing-circle h-11 w-11 text-base"
      >
        ?
      </button>
      {/* The one Signal-Red control — keeping a card is the deck's real
          signal. A plain accent circle (not `nothing-circle`, whose
          foreground fill would override the red) with the same lift/press. */}
      <button
        type="button"
        aria-label="Save to library"
        onClick={onSave}
        disabled={disabled}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-xl text-white shadow-sm transition-transform hover:-translate-y-px hover:scale-105 active:scale-95 disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}
