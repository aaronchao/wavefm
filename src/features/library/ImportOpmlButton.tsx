"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { importSubscriptionsOpml } from "./importOpml";

/**
 * One-click OPML import — bring your subscriptions over from any podcast app.
 * Saves go through Supabase when signed in, so the imported list syncs to
 * every device on its own. Degrades quietly: an unreadable or empty file
 * just reports "nothing imported", never a blocking error.
 */
export function ImportOpmlButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [state, setState] = useState<"idle" | "working" | "done">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file
    if (!file) return;
    setState("working");
    setMsg(null);
    try {
      const { imported, total } = await importSubscriptionsOpml(file);
      setMsg(
        imported > 0
          ? `Imported ${imported}${total > imported ? ` of ${total}` : ""} — syncing across your devices`
          : "Nothing to import from that file",
      );
      void queryClient.invalidateQueries({ queryKey: ["saved"] });
    } catch {
      setMsg("Couldn’t read that file");
    }
    setState("done");
    setTimeout(() => setState("idle"), 4000);
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".opml,.xml,text/xml,application/xml"
        onChange={onFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={state === "working"}
        title="Import subscriptions from an OPML file (Pocket Casts, Apple Podcasts, Overcast…)"
        className="rounded-pill border border-surface-border bg-surface px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-zinc-500 transition-colors hover:text-foreground disabled:opacity-50"
      >
        {state === "working" ? "Importing…" : "Import OPML"}
      </button>
      {msg && <span className="text-xs text-zinc-400">{msg}</span>}
    </div>
  );
}
