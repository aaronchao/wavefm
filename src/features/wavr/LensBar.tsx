"use client";

import { useState } from "react";

/**
 * The Wavr tag bar — Nothing-brand: sharp-edged monochrome chips, dot-matrix
 * type, Signal-Red reserved for the focused lens. These ARE the user's "For
 * You" interests (same store the Discovery tab edits), so add/remove here
 * syncs everywhere. Tapping a chip focuses that lens (jump + fetch more for
 * it); the × removes it; the dashed field on the end adds a new one.
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
    <div className="flex items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-1">
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
        {onAddTag && <AddTag onAdd={onAddTag} />}
      </div>
      <span className="font-brand shrink-0 text-[10px] uppercase tracking-[0.14em] text-zinc-400">
        {remaining} left
      </span>
    </div>
  );
}

/** Distinct dashed add-field — separate from the interest chips (§ request). */
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
