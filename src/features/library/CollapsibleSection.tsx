"use client";

import { useSyncExternalStore } from "react";

/**
 * A section that stays shut until asked for, remembering the choice.
 *
 * The Library had every tool open at once — sync panels, tag rail, episode
 * list, shows — which on a phone is screens of text before the thing you
 * came for. Saved shows lead now; everything else lives behind one of these.
 *
 * Open state persists per section, so a tool someone actually uses daily
 * isn't re-collapsed on every visit — the default is "quiet", not "hidden
 * forever".
 *
 * Read via useSyncExternalStore rather than an effect: /library is
 * prerendered, so a lazy useState reading localStorage would hydrate against
 * markup the server built without it, and setting state from an effect
 * instead just trades that for a cascading re-render. The store's server
 * snapshot is the default, and React reconciles the real value on hydration.
 */

const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function notify(): void {
  for (const l of listeners) l();
}

function readOpen(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === "1" ? true : v === "0" ? false : fallback;
  } catch {
    // private mode / storage disabled — the default is a fine answer
    return fallback;
  }
}

export function CollapsibleSection({
  id,
  title,
  count,
  defaultOpen = false,
  children,
}: {
  /** Stable key for remembering open state. */
  id: string;
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const storageKey = `wavr.library.section.${id}`;
  const open = useSyncExternalStore(
    subscribe,
    () => readOpen(storageKey, defaultOpen),
    () => defaultOpen,
  );

  function toggle() {
    try {
      localStorage.setItem(storageKey, open ? "0" : "1");
    } catch {
      // ignore — nothing to persist to, the section just won't remember
    }
    notify();
  }

  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="font-brand flex w-full items-center gap-2 py-2 text-xs font-bold uppercase tracking-[0.22em] text-zinc-800 transition-colors hover:text-foreground dark:text-zinc-100"
      >
        <span className={`text-[10px] transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
        {title}
        {count != null && (
          <span className="text-[11px] tracking-[0.2em] text-muted-foreground">{count}</span>
        )}
      </button>
      {open && <div className="pt-2">{children}</div>}
    </section>
  );
}
