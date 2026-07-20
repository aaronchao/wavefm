"use client";

import { useState } from "react";
import { exportSubscriptionsOpml } from "./exportOpml";

/**
 * One-click OPML export — hands the user a file they can import into any
 * podcast app (Pocket Casts, Overcast, AntennaPod…). Degrades quietly:
 * "nothing to export" when no feeds are known, never a blocking error.
 */
export function ExportOpmlButton() {
  const [state, setState] = useState<"idle" | "working" | "done" | "empty">("idle");

  async function onClick() {
    setState("working");
    try {
      const count = await exportSubscriptionsOpml();
      setState(count > 0 ? "done" : "empty");
    } catch {
      setState("idle");
    }
    setTimeout(() => setState("idle"), 2500);
  }

  const label =
    state === "working"
      ? "Exporting…"
      : state === "done"
        ? "Downloaded ✓"
        : state === "empty"
          ? "Nothing to export"
          : "Export OPML";

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={state === "working"}
      title="Export your shows as an OPML file for Pocket Casts, Overcast, etc."
      className="rounded-pill border border-surface-border bg-surface px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-zinc-500 transition-colors hover:text-foreground disabled:opacity-50"
    >
      {label}
    </button>
  );
}
