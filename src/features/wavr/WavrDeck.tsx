"use client";

import { useMotionValue, type MotionValue } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { WavrCard } from "@/src/core/wavr";
import type { Decision } from "@/src/core/wavr/deckReducer";
import { setHapticsEnabled } from "@/src/ui";
import { DeckControls } from "./DeckControls";
import { DeckEmpty } from "./DeckEmpty";
import { DeckOverview } from "./DeckOverview";
import { LensBar } from "./LensBar";
import { PeekCard } from "./PeekCard";
import { SwipeCard, type SwipeCardHandle } from "./SwipeCard";
import { useCardGesture } from "./useCardGesture";
import { useDeckAudio, type DeckAudio } from "./useDeckAudio";
import { useSwipeDeck } from "./useSwipeDeck";
import { SiriWaveform } from "@/src/features/player/SiriWaveform";

/**
 * The stack: renders top + 2 peek, owns the deck reducer and the audio ring.
 * The exhausted state is rendered HERE rather than one level up — it must
 * wait for `deck.exhausted` (index-based, flips true only after the last
 * card's exit animation calls `flownOut`), and a parent deriving it from
 * `decided.length` alone would swap the deck out mid-flight, since that
 * count updates on `decide`, before the card has visually left.
 */
export function WavrDeck({
  cards,
  tags,
  noMorePages,
  onAudio,
  onNearEnd,
  onDecidedChange,
  onAddTag,
  onRemoveTag,
}: {
  cards: WavrCard[];
  tags: string[];
  /** No further pages are coming — gates the exhausted screen. */
  noMorePages: boolean;
  onAudio?: (audio: DeckAudio) => void;
  /** Fired once the deck is within 4 cards of the end (§4.4 paging). */
  onNearEnd?: () => void;
  /** Fired whenever the decided set changes, so a fresh page can exclude it. */
  onDecidedChange?: (decided: { card: WavrCard; decision: Decision }[]) => void;
  /** Add/remove an interest tag — writes the shared prefs store (syncs everywhere). */
  onAddTag?: (tag: string) => void;
  onRemoveTag?: (tag: string) => void;
}) {
  // Tag-boost: a tap fetches genuinely NEW recommendations for that tag
  // (not just a reorder of what's already in hand), appended the same way
  // a fresh page is — deduped by id, folded into the one queue below.
  const [boostCards, setBoostCards] = useState<WavrCard[]>([]);
  const allCards = useMemo(() => {
    const seen = new Set(cards.map((c) => c.id));
    return [...cards, ...boostCards.filter((c) => !seen.has(c.id))];
  }, [cards, boostCards]);

  const deck = useSwipeDeck(allCards);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  // Auto-advance when a clip finishes (§ user request #5) — a neutral move to
  // the next card, not a save or a skip. `deck.advance` is a stable callback.
  const audio = useDeckAudio(audioElRef, deck.card, { onEnded: deck.advance });
  const fallbackX = useMotionValue(0);
  const [liveX, setLiveX] = useState<MotionValue<number> | null>(null);
  const topX = liveX ?? fallbackX;
  const overview = deck.state.mode === "overview";
  const cardRef = useRef<SwipeCardHandle | null>(null);
  const [focusedTag, setFocusedTag] = useState<string | null>(null);
  const jumpedForTagRef = useRef<string | null>(null);

  useEffect(() => {
    onAudio?.(audio);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- report on every audio identity change only
  }, [audio]);

  // Haptics and the waveform are always on now (the settings menu is gone —
  // the card gets that space instead).
  useEffect(() => {
    setHapticsEnabled(true);
  }, []);

  // Audio ducks rather than pauses during the overview — you're choosing
  // what to hear next, silence mid-decision is worse than a quieter one (§6.7).
  useEffect(() => {
    audio.setVolume(overview ? 0.25 : 1);
  }, [overview, audio]);

  useEffect(() => {
    if (deck.state.queue.length > 0 && deck.state.index >= deck.state.queue.length - 4) {
      onNearEnd?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onNearEnd is a stable callback ref from the caller
  }, [deck.state.index, deck.state.queue.length]);

  useEffect(() => {
    onDecidedChange?.(deck.state.decided);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onDecidedChange is a stable callback ref from the caller
  }, [deck.state.decided]);

  function handleDecide(decision: "save" | "skip", dir: -1 | 1) {
    deck.decide(decision, dir);
  }

  // Tapping a tag is a real filter, not just a display pill: jump the deck
  // forward to the next upcoming card that matches it, AND fetch genuinely
  // new recommendations for that tag in the background so the deck actually
  // grows richer for it, not just reordered. Tapping the same tag again
  // clears the focus without moving anywhere.
  function tryJumpToTag(tag: string) {
    if (jumpedForTagRef.current === tag) return;
    const { queue, index } = deck.state;
    const match = queue.findIndex((c, i) => i > index && c.matchedTags.includes(tag));
    if (match !== -1) {
      jumpedForTagRef.current = tag;
      deck.jump(match);
    }
  }

  function handleTagClick(tag: string) {
    if (focusedTag === tag) {
      setFocusedTag(null);
      return;
    }
    setFocusedTag(tag);
    jumpedForTagRef.current = null;
    tryJumpToTag(tag);
    void fetchTagBoost(tag);
  }

  async function fetchTagBoost(tag: string) {
    try {
      const res = await fetch(`/api/wavr/feed?${new URLSearchParams({ tags: tag, limit: "8" })}`);
      if (!res.ok) return;
      const body = (await res.json()) as { cards?: unknown } | null;
      const fresh = Array.isArray(body?.cards) ? (body.cards as WavrCard[]) : [];
      if (fresh.length === 0) return;
      setBoostCards((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...fresh.filter((c) => !seen.has(c.id))];
      });
    } catch {
      // best-effort — a failed boost just means no extra cards this time
    }
  }

  // The boost fetch resolves asynchronously; once its cards land in the
  // queue, retry the jump for whichever tag is still focused.
  useEffect(() => {
    if (focusedTag) tryJumpToTag(focusedTag);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-check when the queue actually grows
  }, [deck.state.queue.length]);

  function handleTap() {
    audio.togglePlay();
  }

  const gesture = useCardGesture(deck, cardRef, handleDecide, handleTap);

  function handleKeyDown(e: React.KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
    // While the overview is open it owns the keyboard (arrows scrub the flow,
    // Enter/Escape pick/close) — the deck must NOT also read arrows as a
    // save/skip on the card underneath.
    if (overview) return;
    if (e.key === "ArrowLeft") handleDecide("skip", -1);
    else if (e.key === "ArrowRight") handleDecide("save", 1);
    else if (e.key === " ") {
      e.preventDefault();
      audio.togglePlay();
    } else if (e.key === "Backspace") deck.undo();
    else if (e.key === "o" || e.key === "O") deck.openOverview();
  }

  const card = deck.card;
  const disabled = Boolean(deck.state.flying);

  if (deck.exhausted && noMorePages) {
    const savedCount = deck.state.decided.filter((d) => d.decision === "save").length;
    return <DeckEmpty variant={{ kind: "exhausted", savedCount }} />;
  }

  return (
    <div className="relative">
      {/* The single <audio> element — one clip plays at a time. Kept OUTSIDE
          the card so advancing (which remounts the card) never remounts the
          element and reloads the stream. */}
      <audio ref={audioElRef} preload="none" />

      {/* The waveform, as its own visible band ABOVE the card — animates
          while playing, flat when not. Always on. Same Siri-style flowing
          line as the mini player (PreviewPlayer), not the bar-style
          WaveField this used to be — one waveform look across the app. */}
      <SiriWaveform active={audio.playState === "playing"} progress={audio.progress} />

      <div
        role="group"
        aria-roledescription="card deck"
        aria-label="Recommended episodes"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={gesture.onPointerDown}
        onPointerMove={gesture.onPointerMove}
        onPointerUp={gesture.onPointerUp}
        onPointerCancel={gesture.onPointerUp}
        // The deck's own long-press (→ overview) must not also trigger the
        // browser's native long-press menus on mobile: the image "open/copy
        // image" menu, the text-selection "Search" callout, or the generic
        // context menu. touch-none already stops scroll/zoom; these stop the
        // rest — no text selection, no iOS callout, no context menu.
        onContextMenu={(e) => e.preventDefault()}
        style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
        className="relative h-[27rem] w-full touch-none select-none outline-none focus-visible:outline-2 focus-visible:outline-accent"
      >
        {overview && (
          <DeckOverview
            queue={deck.state.queue}
            scrubIndex={deck.state.scrubIndex ?? deck.state.index}
            onScrub={deck.scrub}
            onJump={deck.jump}
            onClose={deck.closeOverview}
          />
        )}
        {deck.peek[1] && <PeekCard key={deck.peek[1].id} card={deck.peek[1]} depth={2} topX={topX} />}
        {deck.peek[0] && <PeekCard key={deck.peek[0].id} card={deck.peek[0]} depth={1} topX={topX} />}
        {card && (
          <SwipeCard
            key={card.id}
            ref={cardRef}
            card={card}
            flying={deck.state.flying}
            progress={audio.progress}
            playState={audio.playState}
            onSeek={audio.seekTo}
            onFlownOut={deck.flownOut}
            onDragX={setLiveX}
          />
        )}
      </div>

      {card && (
        <div className="mt-5 flex flex-col gap-3">
          <LensBar
            tags={tags}
            remaining={Math.max(0, deck.state.queue.length - deck.state.index)}
            activeTag={focusedTag}
            onTagClick={handleTagClick}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
          />
          <DeckControls
            onSkip={() => handleDecide("skip", -1)}
            onOverview={() => deck.openOverview()}
            onSave={() => handleDecide("save", 1)}
            disabled={disabled}
          />
        </div>
      )}

      {deck.state.undoable && (
        <div role="status" className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <button
            type="button"
            onClick={deck.undo}
            className="font-brand rounded-[2px] bg-foreground px-4 py-2 text-xs uppercase tracking-[0.14em] text-background shadow-lg active:scale-95"
          >
            {deck.state.undoable.decision === "save" ? "Saved" : "Skipped"} · Undo
          </button>
        </div>
      )}

      <p aria-live="polite" className="sr-only">
        {card
          ? `Card ${deck.state.index + 1} of ${deck.state.queue.length}. ${card.title}, from ${card.showTitle}. Reason: ${card.why}.`
          : ""}
      </p>
    </div>
  );
}
