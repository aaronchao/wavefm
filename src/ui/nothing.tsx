"use client";

/**
 * Nothing-brand actionable controls — the tech-brand design language applied
 * to the app's core interactions (Play, Later, and every actionable toggle).
 * Strict monochrome (foreground/background invert automatically per theme),
 * high contrast, sharp engineered edges or perfectly circular hit targets,
 * dot-matrix (`font-brand`) typography. No Signal-Red here by design — these
 * controls are deliberately black/white so the accent stays reserved for
 * signal, not chrome.
 */

const PLAY_SIZES = {
  sm: { box: "h-7 w-7", glyph: 10 },
  md: { box: "h-9 w-9", glyph: 12 },
  lg: { box: "h-11 w-11", glyph: 15 },
} as const;

/** Perfectly circular, monochrome Play button with a crisp geometric glyph. */
export function PlayButton({
  onClick,
  label,
  size = "md",
  disabled = false,
  className = "",
}: {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** Accessible label — the button is icon-only (no text). */
  label: string;
  size?: keyof typeof PLAY_SIZES;
  disabled?: boolean;
  className?: string;
}) {
  const s = PLAY_SIZES[size];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`nothing-circle shrink-0 ${s.box} ${className}`}
    >
      <svg width={s.glyph} height={s.glyph} viewBox="0 0 10 12" fill="currentColor" aria-hidden>
        <path d="M0 0l10 6-10 6z" />
      </svg>
    </button>
  );
}

/**
 * Sharp-edged, monochrome toggle — the shared shape for Later / Save / Done
 * and any actionable on/off control. `active` fills it (inverted); idle is an
 * outline. Passes the event through so it can `stopPropagation` inside a
 * full-card play button.
 */
export function NothingToggle({
  children,
  active = false,
  onClick,
  className = "",
  ariaLabel,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      data-active={active}
      className={`nothing-toggle px-3 py-1.5 text-[11px] font-medium ${className}`}
    >
      {children}
    </button>
  );
}
