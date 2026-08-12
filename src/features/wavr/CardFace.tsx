"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import type { WavrCard } from "@/src/core/wavr";
import { WAVR_CLIP_SEC } from "@/src/core/wavr";
import { CoverTile } from "@/src/ui";
import { springs } from "@/src/ui/tokens";
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
 * The card flips (real 3D rotateY, not a cross-fade) to a back face with the
 * full "why" reasoning, the untruncated quote, every matched tag, and a link
 * that expands into the show's own detail page — the front stays a single
 * glanceable reason, the back is where "tell me more" lives. The flip
 * button is a sibling of the rotating layer, not inside it, so it stays
 * upright and in the same spot on both faces instead of mirroring.
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
  const [flipped, setFlipped] = useState(false);

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
    <div className="relative h-full w-full" style={{ perspective: 1400 }}>
      <motion.div
        className="relative h-full w-full"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={springs.settle}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* backface-visibility only hides a face visually — it's still in the
            DOM and, without this, still reachable by tab order, screen
            readers, and even test queries (the show-name link resolved
            twice before this was added). aria-hidden + inert take the
            non-showing face fully out of the accessibility tree. */}
        <div
          className="absolute inset-0"
          style={{ backfaceVisibility: "hidden" }}
          aria-hidden={flipped}
          // @ts-expect-error -- `inert` is a valid HTML attribute; React's DOM types don't have it yet.
          inert={flipped ? "" : undefined}
        >
          <CardFront card={card} progress={progress} playState={playState} onSeek={onSeek} />
        </div>
        <div
          className="absolute inset-0"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          aria-hidden={!flipped}
          // @ts-expect-error -- `inert` is a valid HTML attribute; React's DOM types don't have it yet.
          inert={!flipped ? "" : undefined}
        >
          <CardBack card={card} />
        </div>
      </motion.div>

      <FlipButton
        flipped={flipped}
        onFlip={() => setFlipped((v) => !v)}
      />
    </div>
  );
}

/** Always upright, always the same corner — a sibling of the rotating
 *  layer rather than a child, so it never mirrors when the back shows. */
function FlipButton({ flipped, onFlip }: { flipped: boolean; onFlip: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onFlip();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      aria-label={flipped ? "Show less" : "Show more about this episode"}
      title={flipped ? "Show less" : "More"}
      className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/60"
    >
      {flipped ? <CloseIcon className="h-3.5 w-3.5" /> : <InfoIcon className="h-3.5 w-3.5" />}
    </button>
  );
}

function CardFront({
  card,
  progress,
  playState,
  onSeek,
}: {
  card: WavrCard;
  progress: number;
  playState: PlayState;
  onSeek?: (fraction: number) => void;
}) {
  const minutes = card.durationSec ? Math.round(card.durationSec / 60) : null;
  const released = formatDate(card.publishedAt);
  const meta = [released, minutes ? `${minutes} min` : null].filter(Boolean).join("  ·  ");

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
          {playState === "loading" && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/15">
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/90"
                    style={{ animationDelay: `${i * 120}ms` }}
                  />
                ))}
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

/** The flip side: the full reasoning a glanceable front can't fit, and the
 *  door into the show's own detail page for genuinely "more". */
function CardBack({ card }: { card: WavrCard }) {
  const minutes = card.durationSec ? Math.round(card.durationSec / 60) : null;
  const released = formatDate(card.publishedAt);

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-[30px] bg-zinc-900 shadow-[0_16px_50px_rgba(0,0,0,0.32)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
      <div className="flex h-full flex-col gap-3 overflow-y-auto px-6 pb-5 pt-6 text-white">
        <div className="flex items-center gap-3">
          <CoverTile
            src={card.coverUrl}
            size={44}
            className="pointer-events-none shrink-0 !rounded-xl"
          />
          <div className="min-w-0">
            <p className="line-clamp-1 text-sm font-semibold leading-tight">{card.title}</p>
            <ShowLink showId={card.showId} showTitle={card.showTitle} />
          </div>
        </div>

        {(released || minutes) && (
          <p className="text-xs tabular-nums text-white/60">
            {[released, minutes ? `${minutes} min` : null].filter(Boolean).join("  ·  ")}
          </p>
        )}

        <div>
          <p className="font-brand mb-1 text-[10px] uppercase tracking-wider text-white/50">
            Why this card
          </p>
          <p className="text-sm leading-snug text-white/90">{card.why}</p>
        </div>

        {card.quote && (
          <div>
            <p className="font-brand mb-1 text-[10px] uppercase tracking-wider text-white/50">
              From the discussion
            </p>
            <p className="text-sm italic leading-snug text-white/85">
              &ldquo;{card.quote.text}&rdquo;
            </p>
            <p className="mt-0.5 text-xs text-white/55">— {card.quote.source}</p>
          </div>
        )}

        {card.matchedTags.length > 0 && (
          <div>
            <p className="font-brand mb-1 text-[10px] uppercase tracking-wider text-white/50">
              Matched your tags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {card.matchedTags.map((t) => (
                <span
                  key={t}
                  className="rounded-pill bg-white/15 px-2 py-0.5 text-[11px] text-white/80"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        <Link
          href={`/show/${card.showId}`}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          className="font-brand mt-auto flex items-center justify-center gap-1.5 rounded-pill bg-accent py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
        >
          Open show page
          <span aria-hidden>→</span>
        </Link>
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

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-5" strokeLinecap="round" />
      <circle cx="12" cy="8.2" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
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
