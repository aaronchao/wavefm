"use client";

import { useSyncExternalStore } from "react";

const KEY = "wavefm.theme";

/**
 * Day / night toggle. The stored choice is applied pre-paint by the inline
 * script in the root layout; this button flips `data-theme` live. State is
 * read straight off the <html> element via a tiny external store, so the
 * icon always mirrors reality (and SSR renders a stable default).
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

const getTheme = () =>
  document.documentElement.dataset.theme === "dark" ? "dark" : "light";

function applyTheme(next: "light" | "dark") {
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // private mode etc. — the toggle still works for this page view
  }
  for (const l of listeners) l();
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "light" as const);

  return (
    <button
      type="button"
      onClick={() => applyTheme(theme === "dark" ? "light" : "dark")}
      aria-label={theme === "dark" ? "Switch to day mode" : "Switch to night mode"}
      title={theme === "dark" ? "Day mode" : "Night mode"}
      className="rounded-full p-2 text-zinc-500 transition-colors hover:text-foreground dark:text-zinc-400"
    >
      {theme === "dark" ? (
        // sun
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5 5l1.6 1.6M17.4 17.4L19 19M19 5l-1.6 1.6M6.6 17.4L5 19" strokeLinecap="round" />
        </svg>
      ) : (
        // moon
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5z" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
