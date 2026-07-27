"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo, useRef } from "react";
import type { WavrCard } from "@/src/core/wavr";
import type { WavrFeedResponse } from "@/src/data/wavr/types";

const PAGE_SIZE = 12;

async function fetchFeed(
  tags: string[],
  cursor: string | null,
  exclude: string[],
): Promise<WavrFeedResponse> {
  const params = new URLSearchParams();
  if (tags.length > 0) params.set("tags", tags.join(","));
  params.set("limit", String(PAGE_SIZE));
  if (cursor) params.set("cursor", cursor);
  if (exclude.length > 0) params.set("exclude", exclude.join(","));
  try {
    const res = await fetch(`/api/wavr/feed?${params.toString()}`);
    if (!res.ok) return { cards: [], cursor: null, degraded: true };
    const body = (await res.json()) as Partial<WavrFeedResponse> | null;
    // A malformed 200 (stub, proxy, upstream hiccup) must degrade, never crash.
    return {
      cards: Array.isArray(body?.cards) ? body.cards : [],
      cursor: typeof body?.cursor === "string" ? body.cursor : null,
      degraded: body?.degraded ?? true,
    };
  } catch {
    return { cards: [], cursor: null, degraded: true }; // offline — same shape as degraded
  }
}

/**
 * TanStack Query wrapper over /api/wavr/feed (§4.4). Query key includes the
 * tag lens, so changing interests starts a clean deck. `reportDecided` feeds
 * decided card ids back in without becoming a query dependency — a fresh
 * page must exclude everything decided so far, but a swipe should never by
 * itself trigger a refetch of pages already in hand.
 */
export function useWavrFeed(tags: string[]) {
  const tagKey = [...tags].sort().join(",");
  const excludeRef = useRef<string[]>([]);

  const query = useInfiniteQuery({
    queryKey: ["wavr", "feed", tagKey],
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      fetchFeed(tags, pageParam, excludeRef.current),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.cursor,
    staleTime: 30 * 60_000,
    gcTime: 2 * 60 * 60_000,
  });

  const cards: WavrCard[] = useMemo(() => {
    const seen = new Set<string>();
    const out: WavrCard[] = [];
    for (const page of query.data?.pages ?? []) {
      for (const c of page.cards) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        out.push(c);
      }
    }
    return out;
  }, [query.data]);

  const pages = query.data?.pages ?? [];
  const degraded = pages.length > 0 && pages.every((p) => p.degraded);

  return {
    cards,
    isLoading: query.isLoading,
    degraded,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    /** Call whenever the decided set changes, so the NEXT page excludes them. */
    reportDecided: (ids: string[]) => {
      excludeRef.current = ids;
    },
  };
}
