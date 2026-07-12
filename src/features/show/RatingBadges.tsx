"use client";

import { useQuery } from "@tanstack/react-query";
import { getRatings } from "@/src/data/ratings/client";
import { PopIn, RatingBadge } from "@/src/ui";

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

/**
 * Lazy rating badges: fetched on view, resolve with a pop or silently
 * render nothing (Section 7 — never blocks, never errors).
 */
export function RatingBadges({ showId, title }: { showId: string; title: string }) {
  const { data } = useQuery({
    queryKey: ["ratings", showId],
    queryFn: () => getRatings(showId, title),
    staleTime: SEVEN_DAYS,
    gcTime: SEVEN_DAYS,
    retry: false,
  });

  const rated = (data ?? []).filter((r) => r.rating !== null);
  if (rated.length === 0) return null;

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {rated.map((r) => (
        <PopIn key={r.source}>
          <RatingBadge source={r.source} rating={r.rating} />
        </PopIn>
      ))}
    </span>
  );
}
