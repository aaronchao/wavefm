"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  addShowTag,
  listShowTags,
  normalizeTag,
  removeShowTag,
} from "@/src/data/repos/showTagsRepo";
import { useSession } from "@/src/state/useSession";

/**
 * Low-friction tag input for a show — type a word, press Enter (or comma),
 * done. Tags sync with the Library filter (same store). Existing tags show as
 * removable Nothing-brand chips. All writes are optimistic + degrade silently.
 */
export function TagEditor({ showId }: { showId: string }) {
  const { session } = useSession();
  const scope = session?.user.id ?? "local";
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  const tagsQ = useQuery({ queryKey: ["showTags", scope], queryFn: listShowTags });
  // defensive de-dupe: a stale cache or an in-flight rename can otherwise
  // render the same tag name twice for a moment
  const tags = [...new Set(tagsQ.data?.[showId] ?? [])];

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["showTags"] });

  // `raw` is passed on the comma path so we commit the just-typed character,
  // not a state value React hasn't applied yet.
  function commit(raw?: string) {
    const tag = normalizeTag(raw ?? draft);
    if (!tag || tags.includes(tag)) {
      setDraft("");
      return;
    }
    setDraft("");
    void addShowTag(showId, tag).then(invalidate);
  }

  function remove(tag: string) {
    void removeShowTag(showId, tag).then(invalidate);
  }

  return (
    <section>
      <h2 className="font-brand mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Your tags
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        {tags.map((t) => (
          <span
            key={t}
            data-active="true"
            className="nothing-toggle inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px]"
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
          placeholder="+ add tag"
          aria-label="Add a tag"
          className="font-brand w-28 rounded-[2px] border border-dashed border-surface-border bg-transparent px-2.5 py-1 text-[11px] uppercase tracking-wider text-foreground placeholder:text-zinc-400 focus:border-foreground focus:outline-none"
        />
      </div>
    </section>
  );
}
