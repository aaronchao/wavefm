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
  // Optimistic echo: a just-added tag shows (and is written) immediately,
  // without waiting on the async repo write → query invalidation → refetch
  // round-trip. On a slow mobile connection that gap made new tags look like
  // they never saved; the echo closes it and the refetch reconciles.
  const [added, setAdded] = useState<string[]>([]);

  // `raw` is passed explicitly on the comma path so we commit the character
  // that was just typed, not a state value React hasn't applied yet.
  function commit(raw?: string) {
    const t = (raw ?? draft).trim();
    setDraft("");
    if (!t) return;
    setAdded((a) => (a.includes(t) ? a : [...a, t]));
    onAdd(t);
  }

  function remove(t: string) {
    setAdded((a) => a.filter((x) => x !== t));
    onRemove(t);
  }

  // defensive de-dupe: props + optimistic echo, and a stale cache or in-flight
  // rename can otherwise render the same tag name twice for a moment
  const uniqueTags = [...new Set([...tags, ...added])];

  return (
    <div
      className="relative z-10 mt-1.5 flex flex-wrap items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      {uniqueTags.map((t) => (
        <span
          key={t}
          className="font-brand inline-flex items-center gap-1 rounded-[2px] border border-surface-border px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-zinc-500"
        >
          #{t}
          <button
            type="button"
            onClick={() => remove(t)}
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
            commit(v.slice(0, -1));
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
        onBlur={() => commit()}
        placeholder="+ tag"
        aria-label="Add a tag"
        className="font-brand w-14 rounded-[2px] border border-dashed border-surface-border bg-transparent px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-foreground placeholder:text-zinc-400 focus:border-foreground focus:outline-none"
      />
    </div>
  );
}
