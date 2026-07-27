"use client";

import { Chip } from "@/src/ui";

/**
 * Active interest-tag chips + the remaining count, as one tidy row level
 * with the header's icon cluster — no redundant "WAVR" label repeating the
 * tab you're already on. Tapping a tag jumps the deck forward to the next
 * card that matches it — a real, visible change, not just a display pill.
 */
export function LensBar({
  tags,
  remaining,
  activeTag,
  onTagClick,
}: {
  tags: string[];
  remaining: number;
  /** The tag currently focused, if any — highlighted, tap again to clear. */
  activeTag?: string | null;
  onTagClick?: (tag: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {tags.length > 0 && (
        <div className="flex min-w-0 gap-1.5 overflow-x-auto">
          {tags.map((t) => (
            <Chip
              key={t}
              active={activeTag ? t === activeTag : true}
              onClick={onTagClick ? () => onTagClick(t) : undefined}
              className="shrink-0 whitespace-nowrap"
            >
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
