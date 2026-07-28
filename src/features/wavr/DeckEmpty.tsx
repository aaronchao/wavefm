"use client";

import Link from "next/link";
import { InterestPicker } from "@/src/features/explore/InterestPicker";
import { MachineLabel } from "@/src/ui";

/** The §9 non-deck states — every one honest, none an error boundary. */
export type DeckEmptyVariant =
  | { kind: "cold-start"; onDone: () => void }
  | { kind: "exhausted"; savedCount: number }
  | { kind: "no-match" }
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
          <PrimaryLink href="/library">View Library</PrimaryLink>
          <SecondaryLink href="/">Back to Discover</SecondaryLink>
          <SecondaryLink href="/">Tune interests</SecondaryLink>
        </div>
      </Empty>
    );
  }
  if (variant.kind === "no-match") {
    return (
      <Empty title="Nothing matches your interests yet.">
        <p className="max-w-xs text-sm text-zinc-500">
          The community-mining pool is still small and skews English/tech
          right now. Try different or broader interests, or check back as
          more discussion gets mined.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <PrimaryLink href="/">Tune interests</PrimaryLink>
          <SecondaryLink href="/">Back to Discover</SecondaryLink>
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
        <PrimaryLink href="/">Go to Discover</PrimaryLink>
      </Empty>
    );
  }
  return (
    <Empty title="Wavr couldn’t reach the discussion sources.">
      <p className="max-w-xs text-sm text-zinc-500">Discover still works.</p>
      <PrimaryLink href="/">Go to Discover</PrimaryLink>
    </Empty>
  );
}

/** Nothing-brand primary CTA — the one Signal-Red, sharp-edged action. */
function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="font-brand mt-1 rounded-[2px] bg-accent px-4 py-2 text-xs uppercase tracking-[0.14em] text-white"
    >
      {children}
    </Link>
  );
}

/** Nothing-brand secondary — monochrome outline chip. */
function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="nothing-toggle mt-1 px-4 py-2 text-[11px]">
      {children}
    </Link>
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
