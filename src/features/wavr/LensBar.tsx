"use client";

import { Chip } from "@/src/ui";

/**
 * Active interest-tag chips + the remaining count, as one tidy row level
 * with the header's icon cluster — no redundant "WAVR" label repeating the
 * tab you're already on.
 */
export function LensBar({ tags, remaining }: { tags: string[]; remaining: number }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {tags.length > 0 && (
        <div className="flex min-w-0 gap-1.5 overflow-x-auto">
          {tags.map((t) => (
            <Chip key={t} active className="shrink-0 whitespace-nowrap">
              {t}
            </Chip>
          ))}
        </div>
      )}
      <span className="shrink-0 font-brand text-[10px] uppercase tracking-[0.14em] text-zinc-400">
        {remaining} left
      </span>
    </div>
  );
}
