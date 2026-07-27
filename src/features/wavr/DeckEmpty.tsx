"use client";

import Link from "next/link";
import { InterestPicker } from "@/src/features/explore/InterestPicker";
import { MachineLabel } from "@/src/ui";

/** The §9 non-deck states — every one honest, none an error boundary. */
export type DeckEmptyVariant =
  | { kind: "cold-start"; onDone: () => void }
  | { kind: "exhausted"; savedCount: number }
  | { kind: "degraded" }
  | { kind: "offline" };

export function DeckEmpty({ variant }: { variant: DeckEmptyVariant }) {
  if (variant.kind === "cold-start") {
    return (
      <Empty title="Wavr needs three things you’re into.">
        <div className="w-full max-w-xs text-left">
          <InterestPicker onDone={variant.onDone} />
        </div>
      </Empty>
    );
  }
  if (variant.kind === "exhausted") {
    return (
      <Empty title={`That’s the deck. ${variant.savedCount} saved.`}>
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href="/library"
            className="rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            View Library
          </Link>
          <Link href="/" className="rounded-pill bg-surface px-4 py-2 text-sm font-semibold">
            Back to Discover
          </Link>
          <Link
            href="/settings"
            className="rounded-pill bg-surface px-4 py-2 text-sm font-semibold"
          >
            Tune interests
          </Link>
        </div>
      </Empty>
    );
  }
  if (variant.kind === "offline") {
    return (
      <Empty title="You’re offline.">
        <p className="max-w-xs text-sm text-zinc-500">
          Wavr couldn’t reach the discussion sources. Discover still works.
        </p>
        <Link
          href="/"
          className="mt-2 rounded-pill bg-accent px-5 py-2.5 text-sm font-semibold text-white"
        >
          Go to Discover
        </Link>
      </Empty>
    );
  }
  return (
    <Empty title="Wavr couldn’t reach the discussion sources.">
      <p className="max-w-xs text-sm text-zinc-500">Discover still works.</p>
      <Link
        href="/"
        className="mt-2 rounded-pill bg-accent px-5 py-2.5 text-sm font-semibold text-white"
      >
        Go to Discover
      </Link>
    </Empty>
  );
}

function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex h-[28rem] flex-col items-center justify-center gap-3 rounded-card border border-surface-border bg-background p-6 text-center">
      <MachineLabel className="text-accent">◆ Wavr</MachineLabel>
      <p className="font-brand text-lg font-bold">{title}</p>
      {children}
    </div>
  );
}
