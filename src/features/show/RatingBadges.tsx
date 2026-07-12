"use client";

import { useQuery } from "@tanstack/react-query";
import { getPrefs } from "@/src/data/repos/prefsRepo";
import { getRatings } from "@/src/data/ratings/client";
import { useSession } from "@/src/state/useSession";
import { PopIn, RatingBadge } from "@/src/ui";

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

/**
 * Lazy rating badges: fetched on view, resolve with a pop or silently
 * render nothing (Section 7 — never blocks, never errors). Respects the
 * per-source toggles in Settings.
 */
export function RatingBadges({ showId, title }: { showId: string; title: string }) {
  const { session } = useSession();
  const scope = session?.user.id ?? "local";
  const prefsQ = useQuery({ queryKey: ["prefs", scope], queryFn: getPrefs });

  const enabled = Object.entries(prefsQ.data?.rating_sources ?? {})
    .filter(([, on]) => on)
    .map(([source]) => source);

  const { data } = useQuery({
    queryKey: ["ratings", showId, enabled.join(",")],
    queryFn: () => getRatings(showId, title, enabled),
    enabled: prefsQ.isSuccess && enabled.length > 0,
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
