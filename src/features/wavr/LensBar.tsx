"use client";

import { useState } from "react";

/**
 * The Wavr tag bar — the user's "For You" interests (same store the Discovery
 * tab edits, so add/remove syncs everywhere). The add field comes FIRST so
 * it's always reachable without scrolling to the end, and the chips wrap so
 * every interest is visible at once. Tapping a chip focuses that lens (jump +
 * fetch more for it); the × removes it.
 */
export function LensBar({
  tags,
  remaining,
  activeTag,
  onTagClick,
  onAddTag,
  onRemoveTag,
}: {
  tags: string[];
  remaining: number;
  activeTag?: string | null;
  onTagClick?: (tag: string) => void;
  onAddTag?: (tag: string) => void;
  onRemoveTag?: (tag: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between px-0.5">
        <span className="font-brand text-[10px] uppercase tracking-[0.14em] text-zinc-400">
          Your interests
        </span>
        <span className="font-brand text-[10px] uppercase tracking-[0.14em] text-zinc-400">
          {remaining} left
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {onAddTag && <AddTag onAdd={onAddTag} />}
        {tags.map((t) => {
          const focused = activeTag === t;
          return (
            <span key={t} className="relative inline-flex shrink-0">
              <button
                type="button"
                onClick={onTagClick ? () => onTagClick(t) : undefined}
                aria-pressed={focused}
                data-active={focused}
                className="nothing-toggle whitespace-nowrap px-3 py-1 text-[11px]"
              >
                {t}
              </button>
              {onRemoveTag && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveTag(t);
                  }}
                  aria-label={`Remove ${t}`}
                  className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-foreground bg-background text-[9px] leading-none text-foreground hover:bg-foreground hover:text-background"
                >
                  ×
                </button>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** The dashed add-field — deliberately first in the row, always reachable. */
function AddTag({ onAdd }: { onAdd: (tag: string) => void }) {
  const [draft, setDraft] = useState("");
  function commit() {
    const t = draft.trim();
    setDraft("");
    if (t) onAdd(t);
  }
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape") setDraft("");
      }}
      onBlur={commit}
      placeholder="+ tag"
      aria-label="Add an interest"
      className="font-brand w-16 shrink-0 rounded-[2px] border border-dashed border-foreground/50 bg-transparent px-2 py-1 text-[11px] uppercase tracking-wider text-foreground placeholder:text-zinc-400 focus:border-foreground focus:outline-none"
    />
  );
}
