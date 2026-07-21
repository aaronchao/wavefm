"use client";

import { useState } from "react";

/**
 * Low-friction inline tag adder for a Library card (Show or Episode) — type
 * a word, press Enter/comma or blur, done. Existing tags render as small
 * removable chips alongside. Stops propagation so it works inside a
 * full-card play button (PlayableCard).
 */
export function InlineTagInput({
  tags,
  onAdd,
  onRemove,
}: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const t = draft.trim();
    setDraft("");
    if (t) onAdd(t);
  }

  return (
    <div
      className="relative z-10 mt-1.5 flex flex-wrap items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      {tags.map((t) => (
        <span
          key={t}
          className="font-brand inline-flex items-center gap-1 rounded-[2px] border border-surface-border px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-zinc-500"
        >
          #{t}
          <button
            type="button"
            onClick={() => onRemove(t)}
            aria-label={`Remove tag ${t}`}
            className="leading-none opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => {
          const v = e.target.value;
          // typing a comma commits the tag — no extra click needed
          if (v.endsWith(",")) {
            setDraft(v.slice(0, -1));
            queueMicrotask(commit);
          } else {
            setDraft(v);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        placeholder="+ tag"
        aria-label="Add a tag"
        className="font-brand w-14 rounded-[2px] border border-dashed border-surface-border bg-transparent px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-foreground placeholder:text-zinc-400 focus:border-foreground focus:outline-none"
      />
    </div>
  );
}
