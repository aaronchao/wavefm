"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { SimilarShow } from "@/src/data/catalog/types";
import { RatingBadges } from "@/src/features/show/RatingBadges";

/**
 * Why-this-pick evidence — the reworked "rating badge" concept. The reason
 * always shows; when we have the actual community threads behind it, the
 * reason chip becomes a tap-to-expand panel with real Reddit / V2EX quotes
 * you can open. Proof, not just a number. A star rating rides alongside
 * when a source has one.
 */
export function Evidence({
  show,
  className = "",
}: {
  show: SimilarShow;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const evidence = show.evidence ?? [];
  const hasEvidence = evidence.length > 0;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={hasEvidence ? () => setOpen((v) => !v) : undefined}
          aria-expanded={hasEvidence ? open : undefined}
          className={`inline-flex items-center gap-1 rounded-pill bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent ${
            hasEvidence ? "cursor-pointer hover:opacity-80" : "cursor-default"
          }`}
        >
          <span aria-hidden className="text-[10px]">
            ◆
          </span>
          {show.why}
          {hasEvidence && (
            <span
              aria-hidden
              className={`text-[9px] transition-transform ${open ? "rotate-90" : ""}`}
            >
              ▸
            </span>
          )}
        </button>
        <RatingBadges showId={show.id} title={show.title} />
      </div>

      <AnimatePresence initial={false}>
        {open && hasEvidence && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2 flex flex-col gap-1.5 overflow-hidden border-l-2 border-accent-soft pl-2.5"
          >
            {evidence.map((e, i) => (
              <li key={i} className="text-xs">
                <span className="font-brand mr-1.5 uppercase tracking-wider text-zinc-400">
                  {e.source}
                </span>
                {e.url ? (
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground/80 hover:text-accent hover:underline"
                  >
                    {e.text} ↗
                  </a>
                ) : (
                  <span className="text-foreground/80">{e.text}</span>
                )}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
