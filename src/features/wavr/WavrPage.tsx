"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { WavrCard } from "@/src/core/wavr";
import type { Decision } from "@/src/core/wavr/deckReducer";
import { getPrefs } from "@/src/data/repos/prefsRepo";
import { player } from "@/src/state/player";
import { useSession } from "@/src/state/useSession";
import { DeckEmpty } from "./DeckEmpty";
import { useWavrFeed } from "./useWavrFeed";
import { WavrDeck } from "./WavrDeck";

function useOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("online", onChange);
      window.addEventListener("offline", onChange);
      return () => {
        window.removeEventListener("online", onChange);
        window.removeEventListener("offline", onChange);
      };
    },
    () => navigator.onLine,
    () => true, // server snapshot — assume online until hydrated
  );
}

/**
 * Wavr — the swipe deck (docs/wavr-route-design.md). Wires the real feed and
 * every §9 state into the deck built in M-W3: cold start, loading, ready,
 * exhausted, degraded, offline. Never an error boundary.
 */
export function WavrPage() {
  const { session } = useSession();
  const scope = session?.user.id ?? "local";
  const queryClient = useQueryClient();
  const online = useOnline();

  // One clip audible app-wide; the global player bar would sit on the deck
  // controls otherwise (§5.4).
  useEffect(() => {
    player.dismiss();
  }, []);

  const prefsQ = useQuery({ queryKey: ["prefs", scope], queryFn: getPrefs });
  const interests = prefsQ.data?.interests ?? [];

  const feed = useWavrFeed(interests);
  const noMorePages = !feed.hasNextPage && !feed.isFetchingNextPage;

  const onNearEnd = useCallback(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- feed identity is stable per render via TanStack Query
  }, [feed.hasNextPage, feed.isFetchingNextPage]);
  const onDecidedChange = useCallback(
    (decided: { card: WavrCard; decision: Decision }[]) => {
      feed.reportDecided(decided.map((d) => d.card.id));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reportDecided is a stable ref-backed setter
    [],
  );

  if (!prefsQ.isLoading && interests.length === 0) {
    return (
      <Shell>
        <DeckEmpty
          variant={{
            kind: "cold-start",
            onDone: () => queryClient.invalidateQueries({ queryKey: ["prefs"] }),
          }}
        />
      </Shell>
    );
  }

  if (!online && feed.cards.length === 0) {
    return (
      <Shell>
        <DeckEmpty variant={{ kind: "offline" }} />
      </Shell>
    );
  }

  if (prefsQ.isLoading || (feed.isLoading && feed.cards.length === 0)) {
    return (
      <Shell>
        <LoadingSkeleton />
      </Shell>
    );
  }

  if (feed.degraded && feed.cards.length === 0) {
    return (
      <Shell>
        <DeckEmpty variant={{ kind: "degraded" }} />
      </Shell>
    );
  }

  return (
    <Shell>
      <WavrDeck
        cards={feed.cards}
        tags={interests}
        noMorePages={noMorePages}
        onNearEnd={onNearEnd}
        onDecidedChange={onDecidedChange}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pb-28 pt-6">
      {children}
    </main>
  );
}

function LoadingSkeleton() {
  return (
    <div className="relative h-[28rem] w-full">
      {[2, 1, 0].map((i) => (
        <div
          key={i}
          className="absolute inset-0 animate-pulse rounded-card border border-surface-border bg-surface"
          style={{ transform: `scale(${1 - i * 0.06}) translateY(${i * 14}px)`, opacity: 1 - i * 0.25 }}
        />
      ))}
    </div>
  );
}
