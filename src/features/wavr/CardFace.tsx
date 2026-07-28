import Link from "next/link";
import type { WavrCard } from "@/src/core/wavr";
import { WAVR_CLIP_SEC } from "@/src/core/wavr";
import { CoverTile } from "@/src/ui";
import { ProgressScrub } from "./ProgressScrub";
import type { PlayState } from "./useDeckAudio";

/**
 * The card face — an Apple Music-style album card: one prominent, consistently
 * sized square cover that "floats" on a soft shadow, then clean centred
 * metadata beneath it. The cover is the same size on every card (a fixed share
 * of the card width, always square) so the deck reads as one coherent stack.
 *
 * `compact` drops everything but the cover + title, for the Cover Flow overview.
 *
 * "Stats": the honest ones the free catalog APIs actually give us — release
 * date and episode length. There are deliberately no play-count numbers: the
 * catalog doesn't expose them, and community mention/author counts are walled
 * off by the no-collaborative-filtering rule (no-collab.test.ts). The real
 * community quote (when one exists) is the social proof instead.
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
  /** Drag-to-seek within the clip. Omitted (compact/overview) renders a plain bar. */
  onSeek?: (fraction: number) => void;
}) {
  const minutes = card.durationSec ? Math.round(card.durationSec / 60) : null;
  const released = formatDate(card.publishedAt);
  const meta = [released, minutes ? `${minutes} min` : null].filter(Boolean).join("  ·  ");

  if (variant === "compact") {
    return (
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-surface-border bg-background">
        <CoverTile src={card.coverUrl} size={240} className="!h-full !w-full !rounded-none" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-surface-border bg-background shadow-[0_10px_40px_rgba(0,0,0,0.18)]">
      {/* Cover hero — centred, a fixed share of the width so every card's art
          is identically sized, floating on a soft drop shadow. */}
      <div className="flex shrink-0 justify-center px-6 pt-6">
        <div className="relative aspect-square w-[56%] max-w-[220px] overflow-hidden rounded-2xl shadow-[0_12px_28px_rgba(0,0,0,0.3)]">
          <CoverTile src={card.coverUrl} size={440} className="!h-full !w-full !rounded-none" />
          {playState === "locked" && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/25">
              <span className="animate-pulse rounded-pill bg-black/70 px-3 py-1.5 text-xs font-semibold text-white">
                ▶ Tap to listen
              </span>
            </span>
          )}
          {playState === "unavailable" && (
            <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center text-[11px] text-white/80">
              preview unavailable
            </span>
          )}
        </div>
      </div>

      {/* Clip progress — a slim, seekable bar under the cover. */}
      <div className="mt-4 flex items-center gap-2 px-6">
        <ProgressScrub progress={progress} onSeek={onSeek} />
        <span className="font-brand shrink-0 text-[10px] tabular-nums text-zinc-400">
          {formatClip(progress * WAVR_CLIP_SEC)} / {formatClip(WAVR_CLIP_SEC)}
        </span>
      </div>

      {/* Metadata block — Apple-Music-clean, centred. */}
      <div className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-hidden px-5 pb-4 pt-3 text-center">
        <h3 className="line-clamp-2 text-[17px] font-semibold leading-tight tracking-tight">
          {card.title}
        </h3>
        <ShowLink showId={card.showId} showTitle={card.showTitle} />
        {meta && <p className="text-xs tabular-nums text-zinc-500">{meta}</p>}
        {card.quote ? (
          <p className="mt-1 line-clamp-2 px-2 text-[13px] italic leading-snug text-foreground/75">
            &ldquo;{card.quote.text}&rdquo;
            <span className="ml-1 text-[11px] not-italic text-zinc-400">— {card.quote.source}</span>
          </p>
        ) : (
          card.matchedTags.length > 0 && (
            <div className="mt-1 flex flex-wrap justify-center gap-1.5">
              {card.matchedTags.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="rounded-pill bg-surface px-2 py-0.5 text-[11px] text-zinc-500"
                >
                  {t}
                </span>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

/**
 * The show name, as a link to its page. Deliberately small (just the name +
 * a chevron) and clearly a link so it reads as tappable, not as swipe area.
 * It stops the pointer stream so the deck's card gesture (tap = play/pause,
 * drag = decide) never fires from a tap here; a real navigation only happens
 * on a genuine click, which the browser already suppresses mid-drag — so a
 * swipe that grazes the name never navigates by accident.
 */
function ShowLink({ showId, showTitle }: { showId: string; showTitle: string }) {
  if (!showTitle) return null;
  return (
    <Link
      href={`/show/${showId}`}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      className="inline-flex max-w-full items-center gap-0.5 text-[13px] font-medium text-accent hover:underline"
    >
      <span className="truncate">{showTitle}</span>
      <span aria-hidden className="shrink-0 text-[15px] leading-none">
        ›
      </span>
    </Link>
  );
}

/** "Jul 12" this year, "Jul 12, 2024" otherwise; empty for unknown dates. */
function formatDate(iso?: string): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions =
    d.getFullYear() === now.getFullYear()
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" };
  return d.toLocaleDateString("en-US", opts);
}

/** m:ss for a clip-relative seconds value. */
function formatClip(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
