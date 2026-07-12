"use client";

import { useState } from "react";
import { Card, Chip, CoverTile, RatingBadge, SettleIn } from "@/src/ui";

/** M3 acceptance page: primitives with playful motion. Dev-only surface. */
export default function DemoPage() {
  const [activeChip, setActiveChip] = useState("storytelling");
  const [key, setKey] = useState(0);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Design system</h1>
        <Chip onClick={() => setKey((k) => k + 1)}>Replay motion</Chip>
      </div>

      <SettleIn key={key}>
        <Card className="flex items-center gap-4">
          <CoverTile size={72} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">Psychology In Seattle</p>
            <p className="truncate text-sm opacity-60">Kirk Honda</p>
            <div className="mt-1 flex gap-2">
              <RatingBadge source="douban" rating={8.7} />
              <RatingBadge source="xiaoyuzhou" rating={null} />
            </div>
          </div>
          <Chip active>Save</Chip>
        </Card>
      </SettleIn>

      <section>
        <h2 className="mb-2 font-semibold">Chips (one-click, springy)</h2>
        <div className="flex flex-wrap gap-2">
          {[
            "storytelling",
            "psychological case studies",
            "book discussions",
            "gay travel stories",
          ].map((label) => (
            <Chip
              key={label}
              active={activeChip === label}
              onClick={() => setActiveChip(label)}
            >
              {label}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Rating badge states</h2>
        <div className="flex items-center gap-3">
          <RatingBadge source="douban" rating={9.1} />
          <RatingBadge source="xiaoyuzhou" rating={7.4} />
          <span className="text-sm opacity-60">
            (null rating renders nothing →)
          </span>
          <RatingBadge source="douban" rating={null} />
        </div>
      </section>
    </main>
  );
}
