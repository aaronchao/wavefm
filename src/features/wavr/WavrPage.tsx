"use client";

import { MachineLabel } from "@/src/ui";

/**
 * Wavr — the swipe deck (docs/wavr-route-design.md).
 *
 * M-W0 scaffold: the route exists, is reachable from the tab bar, and says
 * honestly what it is. The deck itself lands in M-W3 (cards + motion) and
 * M-W4 (real feed); the audio ring it stands on is M-W2.
 */
export function WavrPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      <MachineLabel className="text-accent">◆ Wavr</MachineLabel>
      <h1 className="font-brand text-2xl font-bold">One swipe at a time</h1>
      <p className="max-w-xs text-sm text-zinc-500">
        A deck of episodes worth your next 30 seconds — each one carrying the
        community quote that earned it a place. Hear it, keep it or skip it.
      </p>
      <p className="font-brand text-[11px] uppercase tracking-[0.22em] text-zinc-400">
        Deck under construction
      </p>
    </main>
  );
}
