/**
 * Thin, dependency-free haptics wrapper (docs/wavr-route-design.md §7).
 *
 * `navigator.vibrate` is Android/Chromium only — iOS Safari has no web
 * haptics API. Gated on reduced-motion and a settings toggle; wrapped in
 * try/catch because some browsers throw when called outside user activation.
 */

export type Haptic =
  | "tick"
  | "commit"
  | "reject"
  | "complete"
  | "undo"
  | "expand"
  | "detent"
  | "land";

const PATTERNS: Record<Haptic, number | number[]> = {
  tick: 8,
  commit: 18,
  reject: [6, 40, 6],
  complete: [12, 60, 12],
  undo: 10,
  expand: 14,
  detent: 6,
  land: 16,
};

let hapticsEnabled = true;

/** Settings toggle (default on) — mirrors prefs.haptics. */
export function setHapticsEnabled(on: boolean): void {
  hapticsEnabled = on;
}

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

export function haptic(kind: Haptic): void {
  if (!hapticsEnabled || reducedMotion()) return;
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // outside user activation, or an unsupported platform — a no-op is correct
  }
}
