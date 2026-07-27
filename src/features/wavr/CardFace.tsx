import type { WavrCard } from "@/src/core/wavr";
import { WAVR_CLIP_SEC } from "@/src/core/wavr";
import { CoverTile } from "@/src/ui";
import { ProgressScrub } from "./ProgressScrub";
import { QuoteBlock } from "./QuoteBlock";
import type { PlayState } from "./useDeckAudio";

/**
 * Pure presentation — no motion, no audio beyond the `onSeek` callback it's
 * handed. Trivially snapshot-testable. `compact` drops the quote block and
 * clamps the title to one line, for the overview fan (M-W6).
 *
 * Liquid Glass: a frosted, translucent slab rather than a flat opaque
 * card — the WaveField animation behind it (WavrDeck renders it as a
 * sibling, not a child, so this component stays audio-agnostic) reads
 * through the blur instead of being fully hidden by it.
 */
export function CardFace({
  card,
  progress,
  playState,
  variant = "full",
  onSeek,
}: {
  card: WavrCard;
  progress: number;
  playState: PlayState;
  variant?: "full" | "compact";
  /** Drag-to-seek within the clip. Omitted (e.g. compact/overview) renders a plain bar. */
  onSeek?: (fraction: number) => void;
}) {
  const minutes = card.durationSec ? Math.round(card.durationSec / 60) : null;

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-[28px] border border-white/40 bg-background/45 shadow-[0_8px_40px_rgba(0,0,0,0.16)] backdrop-blur-2xl dark:border-white/10 dark:bg-background/35">
      {/* Specular highlight — the thin catch-light along the top edge that
          reads as "glass" rather than "frosted plastic". */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent"
      />
      {/* max-h caps the aspect-square box so a narrow, tall card (mobile)
          can never squeeze the title/quote section below it to zero. */}
      <div className="relative aspect-square max-h-[55%] w-full shrink bg-surface/60">
        <CoverTile src={card.coverUrl} size={480} className="!h-full !w-full !rounded-none" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 to-transparent" />
        {variant === "full" && (
          <div className="absolute inset-x-3 bottom-1 flex items-center gap-2">
            <ProgressScrub progress={progress} onSeek={onSeek} />
            <span className="font-brand text-[10px] text-white/90">
              {formatClip(progress * WAVR_CLIP_SEC)} / {formatClip(WAVR_CLIP_SEC)}
            </span>
          </div>
        )}
        {playState === "locked" && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="animate-pulse rounded-pill bg-black/60 px-3 py-1.5 text-xs font-semibold text-white">
              ▶ Tap to listen
            </span>
          </span>
        )}
        {playState === "unavailable" && (
          <span className="absolute inset-x-3 bottom-2 rounded-pill bg-black/60 px-2 py-1 text-[11px] text-white/80">
            preview unavailable
          </span>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 border-t border-white/40 bg-background/40 p-3 backdrop-blur-xl dark:border-white/10 dark:bg-background/30">
        <h3
          className={`font-bold leading-tight ${
            variant === "full" ? "line-clamp-2 text-lg" : "truncate text-sm"
          }`}
        >
          {card.title}
        </h3>
        {variant === "full" && (
          <>
            <p className="text-xs text-zinc-500">
              {card.showTitle}
              {minutes ? ` · ${minutes} min` : ""}
            </p>
            {card.quote && <QuoteBlock quote={card.quote} />}
            {card.matchedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {card.matchedTags.map((t) => (
                  <span
                    key={t}
                    className="rounded-pill bg-surface/70 px-2 py-0.5 text-[11px] text-zinc-500"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** m:ss for a clip-relative seconds value. */
function formatClip(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
