"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { WavrCard } from "@/src/core/wavr";
import type { Decision } from "@/src/core/wavr/deckReducer";
import { getPrefs, setInterests } from "@/src/data/repos/prefsRepo";
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
  // Stable identity so the add/remove callbacks (and useWavrFeed's key) don't
  // churn every render when the query data is momentarily undefined.
  const interests = useMemo(() => prefsQ.data?.interests ?? [], [prefsQ.data]);

  // Editing tags here writes to the SAME prefs.interests store the Discovery
  // tab reads (and invalidates the same query key), so a tag added or removed
  // on either tab shows on both — and syncs across devices when signed in
  // (prefsRepo upserts to Supabase; localStorage only when signed out).
  const addInterest = useCallback(
    async (raw: string) => {
      const t = raw.trim();
      if (!t || interests.includes(t)) return;
      await setInterests([...interests, t]);
      await queryClient.invalidateQueries({ queryKey: ["prefs"] });
    },
    [interests, queryClient],
  );
  const removeInterest = useCallback(
    async (t: string) => {
      await setInterests(interests.filter((i) => i !== t));
      await queryClient.invalidateQueries({ queryKey: ["prefs"] });
    },
    [interests, queryClient],
  );

  const feed = useWavrFeed(interests);
  const noMorePages = !feed.hasNextPage && !feed.isFetchingNextPage;

  // WavrDeck's own onNearEnd only fires once its queue is non-empty (it
  // needs a real index to compare against). When a page returns ZERO
  // matching cards the queue never grows, so that signal alone would stall
  // pagination forever — keep pulling pages here until either a card shows
  // up or the pool is confirmed exhausted (-> the no-match state below).
  useEffect(() => {
    if (feed.cards.length === 0 && feed.hasNextPage && !feed.isFetchingNextPage) {
      void feed.fetchNextPage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- feed is a fresh object every render; the fields below are the real deps
  }, [feed.cards.length, feed.hasNextPage, feed.isFetchingNextPage, feed.fetchNextPage]);

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

  // Mid-pagination with nothing yet — keep the skeleton up rather than a
  // blank flash while later pages are still being checked for a match.
  if (feed.isFetchingNextPage && feed.cards.length === 0) {
    return (
      <Shell>
        <LoadingSkeleton />
      </Shell>
    );
  }

  // The whole pool was checked and genuinely nothing cleared MIN_MATCH —
  // distinct from "degraded": every rung answered, just with no honest
  // reason to show a card for these particular interests (§8.4).
  if (noMorePages && feed.cards.length === 0) {
    return (
      <Shell>
        <DeckEmpty variant={{ kind: "no-match" }} />
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
        onAddTag={addInterest}
        onRemoveTag={removeInterest}
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
    // Matches WavrDeck's own min(rem, dvh) stage height so the skeleton
    // never flashes a taller/shorter box than the real deck that replaces it.
    <div className="relative h-[min(28rem,62dvh)] w-full">
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
