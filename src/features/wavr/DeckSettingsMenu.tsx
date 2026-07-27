"use client";

import { useEffect, useRef, useState } from "react";
import { wavrLocalPrefs, type WavrLocalPrefs } from "./localPrefs";

/**
 * A single ⚙ affordance replacing two bare, unlabeled icon buttons
 * (⚡ haptics, 〰 wave background) that gave a sighted user no way to guess
 * what they did. Opens a small labeled menu instead of guessing icons.
 */
export function DeckSettingsMenu({ localPrefs }: { localPrefs: WavrLocalPrefs }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Deck settings"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-7 items-center justify-center rounded-pill border border-surface-border bg-background text-sm text-zinc-500 hover:text-foreground"
      >
        ⚙
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-52 rounded-card border border-surface-border bg-background p-1.5 shadow-lg">
          <SettingsRow
            label="Haptics"
            on={localPrefs.haptics}
            onClick={() => wavrLocalPrefs.set({ haptics: !localPrefs.haptics })}
          />
          <SettingsRow
            label="Wave background"
            on={localPrefs.waveField}
            onClick={() => wavrLocalPrefs.set({ waveField: !localPrefs.waveField })}
          />
        </div>
      )}
    </div>
  );
}

function SettingsRow({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-tile px-2 py-1.5 text-left text-sm hover:bg-surface"
    >
      <span>{label}</span>
      <span
        className={`rounded-pill px-2 py-0.5 text-[10px] uppercase tracking-wider ${
          on ? "bg-accent-soft text-accent" : "bg-surface text-zinc-400"
        }`}
      >
        {on ? "On" : "Off"}
      </span>
    </button>
  );
}
