import type { EdgeEvidence } from "@/src/core/mining/types";

/** The community quote that earned a card its slot — the shown reason IS the score. */
export function QuoteBlock({ quote }: { quote: EdgeEvidence }) {
  return (
    <div className="rounded-tile bg-surface p-2.5">
      <p className="line-clamp-3 text-sm italic text-foreground">&ldquo;{quote.text}&rdquo;</p>
      <p className="mt-1 text-xs text-zinc-500">
        — {quote.source}
        {quote.url && (
          <a
            href={quote.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 text-accent"
            onClick={(e) => e.stopPropagation()}
          >
            ↗
          </a>
        )}
      </p>
    </div>
  );
}
