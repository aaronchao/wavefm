"use client";

import { useMotionValue, type MotionValue } from "framer-motion";
import { useEffect, useState } from "react";
import type { WavrCard } from "@/src/core/wavr";
import type { Decision } from "@/src/core/wavr/deckReducer";
import { setHapticsEnabled } from "@/src/ui";
import { DeckControls } from "./DeckControls";
import { DeckEmpty } from "./DeckEmpty";
import { DeckOverview } from "./DeckOverview";
import { LensBar } from "./LensBar";
import { useWavrLocalPrefs } from "./localPrefs";
import { PeekCard } from "./PeekCard";
import { SwipeCard } from "./SwipeCard";
import { useDeckAudio, type DeckAudio } from "./useDeckAudio";
import { useLongPressScrub } from "./useLongPressScrub";
import { useSwipeDeck } from "./useSwipeDeck";
import { WaveField } from "./WaveField";

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
}) {
  const deck = useSwipeDeck(cards);
  const audio = useDeckAudio(deck.state.queue, deck.state.index);
  const longPress = useLongPressScrub(deck);
  const localPrefs = useWavrLocalPrefs();
  const fallbackX = useMotionValue(0);
  const [liveX, setLiveX] = useState<MotionValue<number> | null>(null);
  const topX = liveX ?? fallbackX;
  const overview = deck.state.mode === "overview";

  useEffect(() => {
    onAudio?.(audio);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- report on every audio identity change only
  }, [audio]);

  useEffect(() => {
    setHapticsEnabled(localPrefs.haptics);
  }, [localPrefs.haptics]);

  // Audio ducks rather than pauses during the overview — you're choosing
  // what to hear next, silence mid-decision is worse than a quieter one (§6.7).
  useEffect(() => {
    audio.setDuck(overview ? 0.25 : 1);
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
    audio.markAdvance();
    deck.decide(decision, dir);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
    if (e.key === "ArrowLeft") handleDecide("skip", -1);
    else if (e.key === "ArrowRight") handleDecide("save", 1);
    else if (e.key === " ") {
      e.preventDefault();
      if (audio.unlocked) audio.togglePlay();
      else audio.unlock();
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
      <div className="mb-2 flex items-start justify-between gap-2">
        <LensBar tags={tags} remaining={Math.max(0, deck.state.queue.length - deck.state.index)} />
        <button
          type="button"
          aria-label="Overview: see the whole deck"
          onClick={() => deck.openOverview()}
          className="shrink-0 rounded-pill border border-surface-border bg-background px-2 py-1 text-sm text-zinc-500 hover:text-foreground"
        >
          ⌸
        </button>
      </div>
      {/* Persistent 3-slot audio ring — must never remount (§5.2). */}
      {audio.slots.map((slot) => (
        <audio key={slot} ref={audio.register(slot)} preload="none" />
      ))}

      <div
        role="group"
        aria-roledescription="card deck"
        aria-label="Recommended episodes"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={longPress.onPointerDown}
        onPointerMove={longPress.onPointerMove}
        onPointerUp={longPress.onPointerUp}
        onPointerCancel={longPress.onPointerUp}
        className="relative h-[28rem] w-full outline-none focus-visible:outline-2 focus-visible:outline-accent"
      >
        <WaveField audio={audio} cardId={card?.id} overview={overview} enabled={localPrefs.waveField} />
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
            card={card}
            flying={deck.state.flying}
            audio={audio}
            onDecide={handleDecide}
            onFlownOut={deck.flownOut}
            onDragX={setLiveX}
          />
        )}
      </div>

      {card && (
        <div className="mt-5">
          <DeckControls
            onSkip={() => handleDecide("skip", -1)}
            onSave={() => handleDecide("save", 1)}
            onTogglePlay={audio.unlocked ? audio.togglePlay : audio.unlock}
            playState={audio.playState}
            disabled={disabled}
          />
        </div>
      )}

      {deck.state.undoable && (
        <div role="status" className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <button
            type="button"
            onClick={deck.undo}
            className="rounded-pill bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-lg active:scale-95"
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
