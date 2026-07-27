"use client";

import { Chip, MachineLabel } from "@/src/ui";

/**
 * Active interest-tag chips + the remaining count. The overview trigger
 * (⌸) lands in M-W6 alongside DeckOverview; this header works standalone
 * until then.
 */
export function LensBar({ tags, remaining }: { tags: string[]; remaining: number }) {
  return (
    <div className="mb-2 flex flex-col gap-2">
      <MachineLabel>
        WAVR · {remaining} LEFT
      </MachineLabel>
      {tags.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tags.map((t) => (
            <Chip key={t} active>
              {t}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
