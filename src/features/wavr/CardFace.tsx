import Link from "next/link";
import type { WavrCard } from "@/src/core/wavr";
import { WAVR_CLIP_SEC } from "@/src/core/wavr";
import { CoverTile } from "@/src/ui";
import { ProgressScrub } from "./ProgressScrub";
import type { PlayState } from "./useDeckAudio";

/**
 * The card face — an immersive Liquid Glass hero (the award-winning Apple
 * "now playing" look): the album art fills the card as a blurred, darkened
 * backdrop, a frosted glass layer floats over it for legibility, and the
 * crisp square cover sits on top with a soft drop shadow. The blurred art is
 * what gives the glass something to refract, so it reads as real material,
 * not a flat panel — and white text over the scrim stays legible on ANY
 * cover, so every card looks consistent.
 *
 * `compact` renders just the crisp square, for the Cover Flow overview.
 *
 * All imagery is `pointer-events-none` and the whole deck is selection- and
 * callout-disabled (see WavrDeck), so a long-press only ever opens the deck's
 * own overview — never the browser's image/text/context menus.
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
  onSeek?: (fraction: number) => void;
}) {
  const minutes = card.durationSec ? Math.round(card.durationSec / 60) : null;
  const released = formatDate(card.publishedAt);
  const meta = [released, minutes ? `${minutes} min` : null].filter(Boolean).join("  ·  ");

  if (variant === "compact") {
    return (
      <div className="h-full w-full overflow-hidden rounded-2xl bg-surface">
        <CoverTile
          src={card.coverUrl}
          size={240}
          className="pointer-events-none !h-full !w-full !rounded-none"
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-[30px] shadow-[0_16px_50px_rgba(0,0,0,0.32)]">
      {/* Immersive blurred-art backdrop — the source of the glass refraction. */}
      {card.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.coverUrl}
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover blur-2xl"
        />
      ) : (
        <div className="absolute inset-0 bg-zinc-800" />
      )}
      {/* Frost + darkening scrim (the Liquid Glass material) + specular edge. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-black/45 to-black/75 backdrop-blur-2xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />

      <div className="relative flex h-full flex-col items-center px-6 pt-5 text-center text-white">
        {/* Crisp cover — same size on every card, floating on a soft shadow.
            (The blurred backdrop already gives the art a huge presence, so
            this can stay moderate and still leave room for the metadata.) */}
        <div className="relative aspect-square w-[60%] max-w-[218px] shrink-0 overflow-hidden rounded-[20px] shadow-[0_16px_36px_rgba(0,0,0,0.55)] ring-1 ring-white/15">
          <CoverTile
            src={card.coverUrl}
            size={500}
            className="pointer-events-none !h-full !w-full !rounded-none"
          />
          {playState === "locked" && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/25">
              <span className="animate-pulse rounded-pill bg-black/70 px-3 py-1.5 text-xs font-semibold">
                ▶ Tap to listen
              </span>
            </span>
          )}
          {playState === "unavailable" && (
            <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center text-[11px] text-white/85">
              preview unavailable
            </span>
          )}
        </div>

        {/* Seekable clip progress. */}
        <div className="mt-3 flex w-full items-center gap-2">
          <ProgressScrub progress={progress} onSeek={onSeek} />
          <span className="font-brand shrink-0 text-[10px] tabular-nums text-white/70">
            {formatClip(progress * WAVR_CLIP_SEC)} / {formatClip(WAVR_CLIP_SEC)}
          </span>
        </div>

        {/* Metadata — white over the glass, legible on any cover. */}
        <div className="mt-2 flex min-h-0 flex-1 flex-col items-center gap-0.5 overflow-hidden pb-4">
          <h3 className="line-clamp-2 text-[17px] font-semibold leading-tight tracking-tight">
            {card.title}
          </h3>
          <ShowLink showId={card.showId} showTitle={card.showTitle} />
          {meta && <p className="text-xs tabular-nums text-white/65">{meta}</p>}
          {card.quote ? (
            <p className="mt-1 line-clamp-2 px-2 text-[13px] italic leading-snug text-white/80">
              &ldquo;{card.quote.text}&rdquo;
              <span className="ml-1 text-[11px] not-italic text-white/55">
                — {card.quote.source}
              </span>
            </p>
          ) : (
            card.matchedTags.length > 0 && (
              <div className="mt-1 flex flex-wrap justify-center gap-1.5">
                {card.matchedTags.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="rounded-pill bg-white/15 px-2 py-0.5 text-[11px] text-white/80 backdrop-blur"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The show name, as a link to its page — a small, clearly-tappable target
 * (name + chevron, in the Signal-Red accent) that reads as a link, not swipe
 * area. Stops the pointer stream so the deck's card gesture never fires from
 * a tap here; a real navigation only happens on a genuine click, which the
 * browser suppresses mid-drag — so a swipe grazing the name never navigates.
 */
function ShowLink({ showId, showTitle }: { showId: string; showTitle: string }) {
  if (!showTitle) return null;
  return (
    <Link
      href={`/show/${showId}`}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      className="inline-flex max-w-full items-center gap-0.5 text-[13px] font-semibold text-accent hover:underline"
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
